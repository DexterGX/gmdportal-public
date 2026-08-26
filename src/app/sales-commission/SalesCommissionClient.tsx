"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  ArrowRight,
  Download,
  ExternalLink,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import {
  CMSClosedInvoice,
  CMSInvoice,
  CMSSettings,
  CMSWeek,
  calcCommission,
  calcAdjustedCommission,
  calcFirstPayment,
  calcSecondPayment,
  deriveInvoiceStatus,
  formatCurrency,
  formatDate,
  getInvoiceRowBg,
  isBonusCustomerName,
  isInvoiceInvalid,
  NOTE_REASON_OPTIONS,
  parseNoteReasons,
} from "./types";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";

type Props = {
  initialUserName: string;
  initialSettings: CMSSettings;
  initialActiveWeek: CMSWeek | null;
  initialApprovedWeeks: CMSWeek[];
  initialLatestApprovedWeek?: CMSWeek | null;
  initialViewWeek?: CMSWeek | null;
  mode: "main" | "draft" | "review";
};

type RowDraft = CMSInvoice & {
  duplicateInvoice?: boolean;
};

type ImportPreviewRow = {
  salesRep: string;
  invoiceDate: string;
  invoiceNumber: string;
  customer: string;
  commissionRate: number;
  amount: number;
  calculatedCommission: number;
  firstPaymentAmount: number;
  secondPaymentAmount: number;
  thirdPartyAmount: number | null;
  refundAmount: number | null;
  notes: string | null;
  firstPaid: boolean;
  firstPaidDate: string | null;
  secondPaid: boolean;
  secondPaidDate: string | null;
  status: CMSInvoice["status"];
};

// Alias map: each key is the canonical field name, value is the list of
// column header variants accepted from QuickBooks or manual files. These
// columns must be present for a row to import.
const REQUIRED_COLUMN_ALIASES: Record<string, string[]> = {
  salesRep: ["Sales Rep", "SalesRep", "Salesperson"],
  invoiceDate: ["Date", "Invoice Date", "InvoiceDate"],
  invoiceNumber: [
    "Invoice#",
    "Invoice #",
    "Num(Invoice#)",
    "Num Invoice",
    "InvoiceNumber",
    "Num",
  ],
  customer: ["Customer", "Client", "Customer Name"],
  commissionRate: [
    "%Cms",
    "Cms",
    "Commission %",
    "Internal Use(%Cms)",
    "Internal Use",
    "CommissionRate",
    "Commission Rate",
  ],
  amount: ["Amount", "Invoice Amount", "Total"],
};

// Optional columns. When present they let an already-partially-or-fully
// paid invoice be imported with its paid status intact, so there's no need
// to go into the database to mark it paid by hand afterward.
const OPTIONAL_COLUMN_ALIASES: Record<string, string[]> = {
  thirdPartyAmount: ["3rd Party", "Third Party", "3rdParty"],
  refundAmount: ["Refund"],
  firstPaidDate: ["1st Paid Date", "1st Paid", "First Paid Date"],
  secondPaidDate: ["2nd Paid Date", "2nd Paid", "Second Paid Date"],
  notes: ["Notes", "Note"],
};

const COLUMN_ALIASES: Record<string, string[]> = {
  ...REQUIRED_COLUMN_ALIASES,
  ...OPTIONAL_COLUMN_ALIASES,
};

/** Find the first key in `row` that matches one of the aliases (case-insensitive). */
function resolveField(row: Record<string, any>, aliases: string[]): any {
  const rowKeys = Object.keys(row);
  for (const alias of aliases) {
    const match = rowKeys.find(
      (k) => k.toLowerCase().trim() === alias.toLowerCase().trim(),
    );
    if (match !== undefined) return row[match];
  }
  return undefined;
}

const emptyDraftRow = (): RowDraft => ({
  id: crypto.randomUUID(),
  weekId: "",
  salesRep: "",
  invoiceDate: new Date().toISOString().slice(0, 10),
  invoiceNumber: "",
  customer: "",
  commissionRate: 0,
  amount: 0,
  calculatedCommission: 0,
  firstPaymentAmount: 0,
  secondPaymentAmount: 0,
  payFirst: false,
  paySecond: false,
  firstPaid: false,
  firstPaidDate: null,
  secondPaid: false,
  secondPaidDate: null,
  thirdPartyAmount: null,
  refundAmount: null,
  notes: null,
  isNew: true,
  status: "PENDING",
  originalInvoiceId: null,
  sortOrder: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

function asNum(v: unknown) {
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,%\s]/g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Convert Excel serial/date strings/Date to YYYY-MM-DD for <input type="date"> */
function normalizeDate(raw: unknown): string {
  if (raw == null || raw === "") return "";

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    // Excel serial date (1900 system)
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const t = String(raw).trim();
  if (!t) return "";

  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const serial = Number(t);
    if (Number.isFinite(serial)) {
      const ms = Math.round((serial - 25569) * 86400 * 1000);
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;

  const m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }

  const parsed = new Date(t);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

function formatStatus(status: string): string {
  switch (status) {
    case "PENDING":
      return "Open";
    case "FIRST_PAYMENT":
      return "1st Payment";
    case "FIRST_PAID":
      return "1st Paid";
    case "SECOND_PAYMENT":
      return "2nd Payment · Closing";
    case "BOTH_PAYMENTS":
      return "Both · Closing";
    case "HOLD":
      return "Hold";
    case "HOLD_SIGNATURE":
      return "Hold – Signature";
    default:
      return status;
  }
}

// Effective status always wins over whatever is stored in row.status, so a
// row carried over from a previous week (or loaded before a fix landed)
// self-heals in the UI without needing an edit or a database change.
function rowDisplayStatus(row: RowDraft): string {
  if (isBonusCustomerName(row.customer)) return "BONUS";
  const effectiveStatus = deriveInvoiceStatus(row);
  if (effectiveStatus === "HOLD" || effectiveStatus === "HOLD_SIGNATURE")
    return formatStatus(effectiveStatus);
  if (isInvoiceInvalid(row)) return "Missing field(s)";
  return formatStatus(effectiveStatus);
}

function weekRangeSlug(week: CMSWeek | null | undefined): string {
  const start = week?.weekStart ? week.weekStart.slice(0, 10) : null;
  const end = week?.weekEnd ? week.weekEnd.slice(0, 10) : null;
  if (start && end) return `${start}_to_${end}`;
  if (start) return start;
  return "no-active-week";
}

function normalizeDecimalDraft(input: string): string {
  return input.replace(/,/g, ".").replace(/[^0-9.]/g, "");
}

function isIntermediateDecimal(value: string): boolean {
  return value === "" || value === "." || /^\d+\.$/.test(value);
}

function getQuickBooksInvoiceUrl(invoiceNumber: string): string {
  return `https://qbo.intuit.com/app/fullSearch/transactions?origin=prominent&instanceId=d1d9818a-6845-4908-b675-59fdbfb79239&text=${encodeURIComponent(
    invoiceNumber.trim(),
  )}`;
}

export default function SalesCommissionClient({
  initialUserName,
  initialSettings,
  initialActiveWeek,
  initialApprovedWeeks,
  initialLatestApprovedWeek = null,
  initialViewWeek = null,
  mode,
}: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState<CMSSettings>(initialSettings);
  const [activeWeek, setActiveWeek] = useState<CMSWeek | null>(
    initialActiveWeek,
  );
  const displayedWeek =
    initialViewWeek ??
    activeWeek ??
    (mode === "main" ? initialLatestApprovedWeek : null);
  const isRecordedViewMode = Boolean(initialViewWeek);
  const canEdit = Boolean(activeWeek) && !isRecordedViewMode;
  const isApprovedSnapshotView =
    mode === "main" &&
    !activeWeek &&
    !isRecordedViewMode &&
    displayedWeek?.status === "APPROVED";
  const [approvedWeeks] = useState<CMSWeek[]>(initialApprovedWeeks);
  const [rows, setRows] = useState<RowDraft[]>(
    displayedWeek?.invoices?.map((row) => ({
      ...row,
      duplicateInvoice: false,
    })) ?? [],
  );
  const [selectedSalesReps, setSelectedSalesReps] = useState<string[]>([]);
  const [customerFilter, setCustomerFilter] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [checkDate, setCheckDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importPreviewRows, setImportPreviewRows] = useState<
    ImportPreviewRow[]
  >([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [numericInputDrafts, setNumericInputDrafts] = useState<
    Record<string, string>
  >({});
  const [openNotesRowId, setOpenNotesRowId] = useState<string | null>(null);
  const [showStartPanel, setShowStartPanel] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewWeeks, setReviewWeeks] = useState<CMSWeek[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewPendingCount, setReviewPendingCount] = useState(0);

  useEffect(() => {
    const sourceWeek =
      initialViewWeek ??
      activeWeek ??
      (mode === "main" ? initialLatestApprovedWeek : null);
    if (sourceWeek) {
      setRows(
        (sourceWeek.invoices ?? []).map((row: CMSInvoice) => ({
          ...row,
          duplicateInvoice: false,
        })),
      );
      setWeekStart(sourceWeek.weekStart.slice(0, 10));
      setWeekEnd(sourceWeek.weekEnd.slice(0, 10));
      setCheckDate(sourceWeek.checkDate.slice(0, 10));
    }
  }, [activeWeek, initialLatestApprovedWeek, initialViewWeek, mode]);

  useEffect(() => {
    setActiveWeek(initialActiveWeek);
  }, [initialActiveWeek]);

  const refreshReviewPendingCount = async () => {
    try {
      const res = await fetch("/api/sales-commission/weeks?status=REVIEW", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error ?? "Unable to load review weeks");
      setReviewPendingCount(Array.isArray(data) ? data.length : 0);
    } catch {
      setReviewPendingCount(0);
    }
  };

  useEffect(() => {
    if (mode !== "main") return;
    refreshReviewPendingCount();
  }, [mode]);

  const salesRepOptions = useMemo(() => {
    return Array.from(
      new Set(rows.map((row) => row.salesRep.trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedRepSelections = selectedSalesReps.map((rep) =>
      rep.toLowerCase(),
    );
    const normalizedCustomer = customerFilter.toLowerCase();
    const normalizedInvoice = invoiceFilter.toLowerCase();
    return rows.filter((row) => {
      if (
        normalizedRepSelections.length > 0 &&
        !normalizedRepSelections.includes(row.salesRep.toLowerCase())
      )
        return false;
      if (
        normalizedCustomer &&
        !row.customer.toLowerCase().includes(normalizedCustomer)
      )
        return false;
      if (
        normalizedInvoice &&
        !row.invoiceNumber.toLowerCase().includes(normalizedInvoice)
      )
        return false;
      return true;
    });
  }, [customerFilter, invoiceFilter, rows, selectedSalesReps]);

  const duplicates = useMemo(() => {
    const count = new Map<string, number>();
    for (const row of rows) {
      const key = row.invoiceNumber.trim();
      if (!key) continue;
      count.set(key, (count.get(key) ?? 0) + 1);
    }
    return count;
  }, [rows]);

  const updateRow = (id: string, patch: Partial<RowDraft>) => {
    if (!canEdit) return;
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const paymentTouched =
          Object.prototype.hasOwnProperty.call(patch, "payFirst") ||
          Object.prototype.hasOwnProperty.call(patch, "paySecond");
        const merged = { ...row, ...patch };
        if (paymentTouched && !merged.payFirst && !merged.firstPaid) {
          merged.paySecond = false;
        }
        const commission = calcCommission(
          asNum(merged.amount),
          asNum(merged.commissionRate),
        );
        const adjustedCommission = calcAdjustedCommission(
          asNum(merged.amount),
          asNum(merged.commissionRate),
          asNum(merged.thirdPartyAmount),
          asNum(merged.refundAmount),
        );
        const firstPaymentAmount = calcFirstPayment(
          commission,
          asNum(settings.firstPaymentPercent),
        );
        const secondBase = calcSecondPayment(
          adjustedCommission,
          firstPaymentAmount,
        );
        return {
          ...merged,
          calculatedCommission: adjustedCommission,
          firstPaymentAmount,
          secondPaymentAmount: secondBase,
          // Always re-derived from Notes + payment flags (see types.ts),
          // so status/color never drift out of sync with what the row
          // actually shows, on every edit -- not just when payFirst,
          // paySecond, or notes are the field being touched.
          status: deriveInvoiceStatus(merged),
        };
      }),
    );
  };

  const updateDecimalField = (
    id: string,
    field: "commissionRate" | "amount" | "thirdPartyAmount" | "refundAmount",
    rawValue: string,
    nullable: boolean,
  ) => {
    if (!canEdit) return;
    const normalized = normalizeDecimalDraft(rawValue);
    const key = `${id}:${field}`;
    setNumericInputDrafts((prev) => ({ ...prev, [key]: normalized }));
    if (isIntermediateDecimal(normalized)) {
      if (normalized === "") {
        updateRow(id, {
          [field]: nullable ? null : 0,
          isNew: false,
        } as Partial<RowDraft>);
      }
      return;
    }
    if ((normalized.match(/\./g) ?? []).length > 1) return;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return;
    updateRow(id, { [field]: parsed, isNew: false } as Partial<RowDraft>);
  };

  const commitDecimalField = (
    id: string,
    field: "commissionRate" | "amount" | "thirdPartyAmount" | "refundAmount",
    nullable: boolean,
  ) => {
    if (!canEdit) return;
    const key = `${id}:${field}`;
    const raw = numericInputDrafts[key];
    if (raw == null) return;
    if (raw === "" || raw === ".") {
      updateRow(id, {
        [field]: nullable ? null : 0,
        isNew: false,
      } as Partial<RowDraft>);
    } else {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        updateRow(id, { [field]: parsed, isNew: false } as Partial<RowDraft>);
      }
    }
    setNumericInputDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const getNumericInputValue = (
    row: RowDraft,
    field: "commissionRate" | "amount" | "thirdPartyAmount" | "refundAmount",
  ): string => {
    const key = `${row.id}:${field}`;
    if (Object.prototype.hasOwnProperty.call(numericInputDrafts, key)) {
      return numericInputDrafts[key];
    }
    const value = row[field];
    if (value == null) return "";
    return String(value);
  };

  const buildPersistableRows = (): RowDraft[] => {
    return rows.map((row) => {
      const merged: RowDraft = { ...row };
      const draftFields: Array<
        "commissionRate" | "amount" | "thirdPartyAmount" | "refundAmount"
      > = ["commissionRate", "amount", "thirdPartyAmount", "refundAmount"];

      for (const field of draftFields) {
        const key = `${row.id}:${field}`;
        if (!Object.prototype.hasOwnProperty.call(numericInputDrafts, key)) {
          continue;
        }
        const raw = numericInputDrafts[key];
        if (raw === "" || raw === ".") {
          (merged as any)[field] =
            field === "thirdPartyAmount" || field === "refundAmount" ? null : 0;
          continue;
        }
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
          (merged as any)[field] = parsed;
        }
      }

      const baseCommission = calcCommission(
        asNum(merged.amount),
        asNum(merged.commissionRate),
      );
      const adjustedCommission = calcAdjustedCommission(
        asNum(merged.amount),
        asNum(merged.commissionRate),
        asNum(merged.thirdPartyAmount),
        asNum(merged.refundAmount),
      );
      const firstPaymentAmount = calcFirstPayment(
        baseCommission,
        asNum(settings.firstPaymentPercent),
      );
      const secondPaymentAmount = calcSecondPayment(
        adjustedCommission,
        firstPaymentAmount,
      );

      merged.calculatedCommission = adjustedCommission;
      merged.firstPaymentAmount = firstPaymentAmount;
      merged.secondPaymentAmount = secondPaymentAmount;
      // Self-heal: recompute status from Notes + payment flags on every
      // save, so a row that was carried over with a stale status (or
      // loaded before this fix) gets corrected in the database the next
      // time the draft is saved, with no manual edit required.
      merged.status = deriveInvoiceStatus(merged);

      return merged;
    });
  };

  const addRow = () => {
    if (!canEdit) return;
    setRows((prev) => [...prev, emptyDraftRow()]);
  };
  const removeRow = (id: string) => {
    if (!canEdit) return;
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const importFile = async (file: File) => {
    setImportError(null);
    setImportFileName(file.name);
    setImportPreviewRows([]);

    const ext = file.name.split(".").pop()?.toLowerCase();
    let data: Record<string, any>[] = [];

    if (ext === "xlsx" || ext === "xls") {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: "",
      });
    } else {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, any>>(text, {
        header: true,
        skipEmptyLines: true,
      });
      data = parsed.data;
    }

    if (!data.length) {
      setImportError("The file appears to be empty.");
      return;
    }

    const firstRow = data[0];
    const missingFields = Object.entries(REQUIRED_COLUMN_ALIASES)
      .filter(([, aliases]) => resolveField(firstRow, aliases) === undefined)
      .map(([field]) => field);

    if (missingFields.length > 0) {
      const readable = missingFields
        .map((f) => REQUIRED_COLUMN_ALIASES[f][0])
        .join(", ");
      setImportError(`Missing required column(s): ${readable}`);
      return;
    }

    setImportPreviewRows(buildPreviewRows(data));
  };

  const downloadTemplate = (filled: boolean) => {
    const headers = [
      "Sales Rep",
      "Date",
      "Invoice#",
      "Customer",
      "%Cms",
      "Amount",
      "3rd Party",
      "Refund",
      "1st Paid Date",
      "2nd Paid Date",
      "Notes",
    ];
    const rowsToExport = filled
      ? [
          {
            "Sales Rep": "Sales Test",
            Date: new Date().toISOString().slice(0, 10),
            "Invoice#": "12345",
            Customer: "Sample Customer",
            "%Cms": 8,
            Amount: 1000,
            "3rd Party": 0,
            Refund: 0,
            "1st Paid Date": new Date().toISOString().slice(0, 10),
            "2nd Paid Date": "",
            Notes: "Sample row - 1st payment already received",
          },
        ]
      : [
          {
            "Sales Rep": "",
            Date: "",
            "Invoice#": "",
            Customer: "",
            "%Cms": "",
            Amount: "",
            "3rd Party": "",
            Refund: "",
            "1st Paid Date": "",
            "2nd Paid Date": "",
            Notes: "",
          },
        ];

    const ws = XLSX.utils.json_to_sheet(rowsToExport, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Import Template");
    const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    // Filename carries the working week's date range so a template
    // downloaded today is easy to trace back to which week's invoices it
    // was used to import later.
    const rangeSlug = weekRangeSlug(activeWeek);
    anchor.download = filled
      ? `sales-commission-sample-${rangeSlug}.xlsx`
      : `sales-commission-empty-template-${rangeSlug}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const buildPreviewRows = (
    data: Record<string, any>[],
  ): ImportPreviewRow[] => {
    return data
      .map((row) => {
        const salesRep = String(
          resolveField(row, COLUMN_ALIASES.salesRep) ?? "",
        ).trim();
        const invoiceDateRaw = resolveField(row, COLUMN_ALIASES.invoiceDate);
        const invoiceDateNorm = normalizeDate(invoiceDateRaw);
        const invoiceNumber = String(
          resolveField(row, COLUMN_ALIASES.invoiceNumber) ?? "",
        ).trim();
        const customer = String(
          resolveField(row, COLUMN_ALIASES.customer) ?? "",
        ).trim();
        const commissionRate = asNum(
          resolveField(row, COLUMN_ALIASES.commissionRate) ?? 0,
        );
        const amount = asNum(resolveField(row, COLUMN_ALIASES.amount) ?? 0);

        // Optional columns: let an invoice that was already paid (in full
        // or in part) outside the system import with its paid status
        // intact, instead of always landing as a fresh Open invoice.
        const thirdPartyRaw = resolveField(
          row,
          OPTIONAL_COLUMN_ALIASES.thirdPartyAmount,
        );
        const thirdPartyAmount =
          thirdPartyRaw !== undefined && String(thirdPartyRaw).trim() !== ""
            ? asNum(thirdPartyRaw)
            : null;
        const refundRaw = resolveField(
          row,
          OPTIONAL_COLUMN_ALIASES.refundAmount,
        );
        const refundAmount =
          refundRaw !== undefined && String(refundRaw).trim() !== ""
            ? asNum(refundRaw)
            : null;
        const firstPaidDate =
          normalizeDate(
            resolveField(row, OPTIONAL_COLUMN_ALIASES.firstPaidDate),
          ) || null;
        const secondPaidDate =
          normalizeDate(
            resolveField(row, OPTIONAL_COLUMN_ALIASES.secondPaidDate),
          ) || null;
        const notesRaw = resolveField(row, OPTIONAL_COLUMN_ALIASES.notes);
        const notes =
          notesRaw !== undefined && String(notesRaw).trim() !== ""
            ? String(notesRaw).trim()
            : null;
        const firstPaid = Boolean(firstPaidDate);
        const secondPaid = Boolean(secondPaidDate);

        const commission = calcCommission(amount, commissionRate);
        const adjustedCommission = calcAdjustedCommission(
          amount,
          commissionRate,
          asNum(thirdPartyAmount),
          asNum(refundAmount),
        );
        const firstPaymentAmount = calcFirstPayment(
          commission,
          asNum(settings.firstPaymentPercent),
        );
        const secondPaymentAmount = calcSecondPayment(
          adjustedCommission,
          firstPaymentAmount,
        );
        return {
          salesRep,
          invoiceDate: invoiceDateNorm,
          invoiceNumber,
          customer,
          commissionRate,
          amount,
          calculatedCommission: adjustedCommission,
          firstPaymentAmount,
          secondPaymentAmount,
          thirdPartyAmount,
          refundAmount,
          notes,
          firstPaid,
          firstPaidDate,
          secondPaid,
          secondPaidDate,
          status: deriveInvoiceStatus({
            notes,
            payFirst: false,
            paySecond: false,
            firstPaid,
            secondPaid,
          }),
        };
      })
      .filter(
        (row) =>
          row.salesRep ||
          row.invoiceDate ||
          row.invoiceNumber ||
          row.customer ||
          row.commissionRate ||
          row.amount,
      );
  };

  const confirmImportRows = () => {
    if (!canEdit) return;
    const imported: RowDraft[] = importPreviewRows.map((row, index) => {
      const commission = calcCommission(row.amount, row.commissionRate);
      const adjustedCommission = calcAdjustedCommission(
        row.amount,
        row.commissionRate,
        asNum(row.thirdPartyAmount),
        asNum(row.refundAmount),
      );
      const firstPaymentAmount = calcFirstPayment(
        commission,
        asNum(settings.firstPaymentPercent),
      );
      const secondPaymentAmount = calcSecondPayment(
        adjustedCommission,
        firstPaymentAmount,
      );
      return {
        ...emptyDraftRow(),
        id: crypto.randomUUID(),
        salesRep: row.salesRep,
        invoiceDate: row.invoiceDate,
        invoiceNumber: row.invoiceNumber,
        customer: row.customer,
        commissionRate: row.commissionRate,
        amount: row.amount,
        calculatedCommission: adjustedCommission,
        firstPaymentAmount,
        secondPaymentAmount,
        thirdPartyAmount: row.thirdPartyAmount,
        refundAmount: row.refundAmount,
        notes: row.notes,
        // payFirst/paySecond stay false: those checkboxes mean "pay this
        // in the current run", not "was already paid". An already-paid
        // import instead sets firstPaid/secondPaid with their paid dates
        // directly, mirroring how invoices carried over between weeks are
        // marked paid.
        firstPaid: row.firstPaid,
        firstPaidDate: row.firstPaidDate,
        secondPaid: row.secondPaid,
        secondPaidDate: row.secondPaidDate,
        status: row.status,
        sortOrder: rows.length + index,
      };
    });

    setRows((prev) => [...prev, ...imported]);
    setMessage(
      `${imported.length} invoice(s) added from ${importFileName || "file"}.`,
    );
    setImportFileName("");
    setImportPreviewRows([]);
    setImportError(null);
    setShowImportModal(false);
  };

  const saveDraft = async () => {
    if (!activeWeek || !canEdit) return;
    setBusy(true);
    setMessage(null);
    try {
      const persistableRows = buildPersistableRows();
      setRows(persistableRows);
      const payload = persistableRows.map((row, index) => ({
        ...row,
        weekId: activeWeek.id,
        sortOrder: index,
        thirdPartyAmount: row.thirdPartyAmount ?? null,
        refundAmount: row.refundAmount ?? null,
      }));
      const res = await fetch("/api/sales-commission/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekId: activeWeek.id,
          rows: payload,
          replace: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Unable to save draft.");
      setMessage("Draft saved.");
    } catch (error: any) {
      setMessage(error?.message || "Unable to save draft.");
    } finally {
      setBusy(false);
    }
  };

  const startNewWeek = async () => {
    if (!weekStart || !weekEnd || !checkDate) return;
    setBusy(true);
    try {
      const res = await fetch("/api/sales-commission/weeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, weekEnd, checkDate, notes: "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to create week");
      setActiveWeek(data);
      setShowStartPanel(false);
      setRows(
        (data.invoices ?? []).map((row: CMSInvoice) => ({
          ...row,
          duplicateInvoice: false,
        })),
      );
      setMessage("New draft week started.");
    } catch (error: any) {
      setMessage(error.message || "Unable to start week.");
    } finally {
      setBusy(false);
    }
  };

  const approveWeek = async () => {
    if (!activeWeek) return;
    setBusy(true);
    try {
      const res = await fetch("/api/sales-commission/weeks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeWeek.id, status: "APPROVED" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to approve week");
      router.refresh();
      setMessage("Week approved.");
    } catch (error: any) {
      setMessage(error.message || "Unable to approve.");
    } finally {
      setBusy(false);
    }
  };

  const sendToReview = async () => {
    if (!activeWeek || !canEdit) return;
    setBusy(true);
    try {
      // Auto-save current draft rows before moving the week to REVIEW.
      const persistableRows = buildPersistableRows();
      setRows(persistableRows);
      const payload = persistableRows.map((row, index) => ({
        ...row,
        weekId: activeWeek.id,
        sortOrder: index,
        thirdPartyAmount: row.thirdPartyAmount ?? null,
        refundAmount: row.refundAmount ?? null,
      }));
      const saveRes = await fetch("/api/sales-commission/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekId: activeWeek.id,
          rows: payload,
          replace: true,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok)
        throw new Error(
          saveData?.error ?? "Unable to save draft before review",
        );

      const res = await fetch("/api/sales-commission/weeks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeWeek.id, status: "REVIEW" }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "Unable to send week to review");
      window.scrollTo({ top: 0, behavior: "auto" });
      window.location.assign("/sales-commission");
      return;
    } catch (error: any) {
      setMessage(error.message || "Unable to send week to review.");
    } finally {
      setBusy(false);
    }
  };

  const sendReviewBackToDraft = async () => {
    if (!activeWeek) return;
    setBusy(true);
    try {
      const res = await fetch("/api/sales-commission/weeks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeWeek.id, status: "DRAFT" }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "Unable to send week back to draft");
      router.refresh();
      setMessage("Week sent back to draft.");
    } catch (error: any) {
      setMessage(error.message || "Unable to send week back to draft.");
    } finally {
      setBusy(false);
    }
  };

  // Column layout mirrors the Closed Invoices export so the two files read
  // the same way side by side.
  const COMMISSION_EXPORT_HEADERS = [
    "Sales Rep",
    "Date",
    "Invoice#",
    "Customer",
    "%Cms",
    "Amount",
    "Commission",
    "1st Payment",
    "1st Paid Date",
    "2nd Payment",
    "2nd Paid Date",
    "3rd Party",
    "Refund",
    "Notes",
    "Status",
  ];
  const CLOSED_EXPORT_HEADERS = [
    "Sales Rep",
    "Date",
    "Invoice#",
    "Customer",
    "%Cms",
    "Amount",
    "Commission",
    "1st Payment",
    "1st Paid Date",
    "2nd Payment",
    "2nd Paid Date",
    "3rd Party",
    "Refund",
    "Notes",
    "Closed At",
  ];

  const exportExcel = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const commissionRows = filteredRows.map((row) => ({
        "Sales Rep": row.salesRep,
        Date: formatDate(row.invoiceDate),
        "Invoice#": row.invoiceNumber,
        Customer: row.customer,
        "%Cms": row.commissionRate,
        Amount: row.amount,
        Commission: row.calculatedCommission,
        "1st Payment": row.firstPaymentAmount,
        "1st Paid Date": formatDate(row.firstPaidDate),
        "2nd Payment": row.secondPaymentAmount,
        "2nd Paid Date": formatDate(row.secondPaidDate),
        "3rd Party": row.thirdPartyAmount ?? "",
        Refund: row.refundAmount ?? "",
        Notes: row.notes ?? "",
        Status: formatStatus(deriveInvoiceStatus(row)),
      }));

      const wb = XLSX.utils.book_new();
      const commissionSheet = XLSX.utils.json_to_sheet(commissionRows, {
        header: COMMISSION_EXPORT_HEADERS,
      });
      XLSX.utils.book_append_sheet(wb, commissionSheet, "Commission");

      // Second tab: every closed invoice, so a single file has both the
      // invoices currently being worked and the full history of what has
      // already been closed out.
      const closedRes = await fetch("/api/sales-commission/closed", {
        cache: "no-store",
      });
      const closedData = closedRes.ok ? await closedRes.json() : [];
      const closedRows = (
        Array.isArray(closedData) ? (closedData as CMSClosedInvoice[]) : []
      ).map((row) => ({
        "Sales Rep": row.salesRep,
        Date: formatDate(row.invoiceDate),
        "Invoice#": row.invoiceNumber,
        Customer: row.customer,
        "%Cms": row.commissionRate,
        Amount: row.amount,
        Commission: row.calculatedCommission,
        "1st Payment": row.firstPaymentAmount,
        "1st Paid Date": formatDate(row.firstPaidDate),
        "2nd Payment": row.secondPaymentAmount,
        "2nd Paid Date": formatDate(row.secondPaidDate),
        "3rd Party": row.thirdPartyAmount ?? "",
        Refund: row.refundAmount ?? "",
        Notes: row.notes ?? "",
        "Closed At": formatDate(row.closedAt),
      }));
      const closedSheet = XLSX.utils.json_to_sheet(closedRows, {
        header: CLOSED_EXPORT_HEADERS,
      });
      XLSX.utils.book_append_sheet(wb, closedSheet, "Closed Invoices");

      const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-commission-${weekRangeSlug(displayedWeek)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setMessage(error?.message || "Unable to export.");
    } finally {
      setBusy(false);
    }
  };

  const openReviewPicker = async () => {
    if (reviewPendingCount === 0) return;
    setShowReviewModal(true);
    setReviewLoading(true);
    try {
      const res = await fetch(
        "/api/sales-commission/weeks?status=REVIEW&includeInvoices=true",
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error ?? "Unable to load review weeks");
      setReviewWeeks(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setMessage(error?.message ?? "Unable to load review weeks.");
      setReviewWeeks([]);
    } finally {
      setReviewLoading(false);
    }
  };

  const updateReviewWeekStatus = async (
    weekId: string,
    status: "APPROVED" | "DRAFT",
  ) => {
    setBusy(true);
    try {
      const res = await fetch("/api/sales-commission/weeks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: weekId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Unable to update week.");
      setShowReviewModal(false);
      router.refresh();
      await refreshReviewPendingCount();
      setMessage(
        status === "APPROVED"
          ? "Review week approved."
          : "Review week returned to draft.",
      );
    } catch (error: any) {
      setMessage(error?.message ?? "Unable to update review week.");
    } finally {
      setBusy(false);
    }
  };

  const printView = () => window.print();

  // Per-rep summary
  const repSummary = useMemo(() => {
    const minimumWeeklyCommissionByLaw = 560;
    const referenceDate = checkDate || weekEnd || weekStart;
    const referenceMonthDate = referenceDate
      ? new Date(`${referenceDate.slice(0, 10)}T00:00:00`)
      : new Date();
    const safeReferenceDate = Number.isNaN(referenceMonthDate.getTime())
      ? new Date()
      : referenceMonthDate;
    const monthStart = new Date(
      safeReferenceDate.getFullYear(),
      safeReferenceDate.getMonth(),
      1,
    );
    const monthEnd = new Date(
      safeReferenceDate.getFullYear(),
      safeReferenceDate.getMonth() + 1,
      0,
    );
    const monthLabel = safeReferenceDate.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });

    const map = new Map<
      string,
      {
        invoiceAmount: number;
        monthSales: number;
        totalCms: number;
        commissionLeft: number;
        commissionThisWeek: number;
        bonus: number;
      }
    >();

    for (const row of filteredRows) {
      const rep = row.salesRep || "(unassigned)";
      const existing = map.get(rep) ?? {
        invoiceAmount: 0,
        monthSales: 0,
        totalCms: 0,
        commissionLeft: 0,
        commissionThisWeek: 0,
        bonus: 0,
      };

      const invoiceAmount = asNum(row.amount);
      const totalCms = asNum(row.calculatedCommission);
      const firstPaymentAmount = asNum(row.firstPaymentAmount);
      const secondPaymentAmount = asNum(row.secondPaymentAmount);
      const commissionThisWeek =
        (row.payFirst ? firstPaymentAmount : 0) +
        (row.paySecond ? secondPaymentAmount : 0);
      const unpaidFirst =
        row.firstPaidDate || row.firstPaid ? 0 : firstPaymentAmount;
      const unpaidSecond =
        row.secondPaidDate || row.secondPaid ? 0 : secondPaymentAmount;
      const isBonusRow = isBonusCustomerName(row.customer);
      const bonus = isBonusRow ? invoiceAmount : 0;
      const salesAmount = isBonusRow ? 0 : invoiceAmount;

      const rowDateValue = (row.invoiceDate || "").slice(0, 10);
      const rowDate = rowDateValue
        ? new Date(`${rowDateValue}T00:00:00`)
        : null;
      const isInCurrentMonth =
        rowDate !== null &&
        !Number.isNaN(rowDate.getTime()) &&
        rowDate >= monthStart &&
        rowDate <= monthEnd;

      map.set(rep, {
        invoiceAmount: existing.invoiceAmount + salesAmount,
        monthSales: existing.monthSales + (isInCurrentMonth ? salesAmount : 0),
        totalCms: existing.totalCms + (isBonusRow ? 0 : totalCms),
        commissionLeft:
          existing.commissionLeft +
          (isBonusRow ? 0 : unpaidFirst + unpaidSecond),
        commissionThisWeek:
          existing.commissionThisWeek + (isBonusRow ? 0 : commissionThisWeek),
        bonus: existing.bonus + bonus,
      });
    }

    return Array.from(map.entries()).map(([rep, vals]) => ({
      rep,
      ...vals,
      monthLabel,
      commissionLeft: Math.max(
        0,
        vals.commissionLeft - vals.commissionThisWeek,
      ),
      minWageComplement: Math.max(
        0,
        minimumWeeklyCommissionByLaw - vals.commissionThisWeek,
      ),
      finalWeekPay:
        vals.commissionThisWeek +
        Math.max(0, minimumWeeklyCommissionByLaw - vals.commissionThisWeek) +
        vals.bonus,
    }));
  }, [filteredRows, checkDate, weekEnd, weekStart]);

  const overallTotalCommission = repSummary.reduce(
    (sum, rep) => sum + rep.totalCms,
    0,
  );
  const overallInvoiceSales = repSummary.reduce(
    (sum, rep) => sum + rep.invoiceAmount,
    0,
  );
  const overallCommissionThisWeek = repSummary.reduce(
    (sum, rep) => sum + rep.commissionThisWeek,
    0,
  );
  const overallBonus = repSummary.reduce((sum, rep) => sum + rep.bonus, 0);
  const overallComplement = repSummary.reduce(
    (sum, rep) => sum + rep.minWageComplement,
    0,
  );
  const overallFinalPayroll = repSummary.reduce(
    (sum, rep) => sum + rep.finalWeekPay,
    0,
  );

  const hasAnyWeekDate = Boolean(weekStart || weekEnd || checkDate);
  const workingWeekLabel = activeWeek
    ? "Active Working Week"
    : isRecordedViewMode
      ? "Viewing Recorded Week"
      : isApprovedSnapshotView
        ? "Latest Approved Week"
        : hasAnyWeekDate
          ? "Pending Working Week"
          : "Working Week Not Set";
  const weekRangeText =
    weekStart && weekEnd
      ? `${formatDate(weekStart)} - ${formatDate(weekEnd)}`
      : "Week range not selected";
  const checkDateText = checkDate
    ? formatDate(checkDate)
    : "Check date not selected";
  const printSalesRep =
    selectedSalesReps.length > 0 ? selectedSalesReps.join(", ") : "All";

  return (
    <div className="sales-commission-print space-y-4 print:space-y-2">
      <div className="rounded-2xl border bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500">
              Sales Commission
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900">
              {isRecordedViewMode
                ? "Recorded Week"
                : mode === "main"
                  ? "Current Week"
                  : mode === "draft"
                    ? "Draft Week"
                    : "Review Week"}
            </h1>
            <p className="mt-1 text-xs text-gray-600">
              Logged in as {initialUserName || "user"}. Week commissions run
              Friday to Thursday and are approved after review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <>
                <button
                  onClick={saveDraft}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1.5 text-sm text-white"
                >
                  <Save className="h-3.5 w-3.5" /> Save Draft
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm text-gray-700"
                >
                  <Upload className="h-3.5 w-3.5" /> Import CSV / Excel
                </button>
              </>
            )}
            {mode === "main" && (
              <button
                onClick={openReviewPicker}
                disabled={reviewPendingCount === 0 || busy}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
                  reviewPendingCount === 0 || busy
                    ? "cursor-not-allowed border-gray-300 bg-gray-100 text-gray-400"
                    : "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                }`}
                title={
                  reviewPendingCount === 0
                    ? "No review weeks pending"
                    : `Review weeks pending: ${reviewPendingCount}`
                }
              >
                Review
              </button>
            )}
            {mode === "main" && !activeWeek && !isRecordedViewMode && (
              <button
                onClick={() => setShowStartPanel((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-sm text-white"
              >
                <Plus className="h-3.5 w-3.5" /> Start Weekly Commission
              </button>
            )}
            <button
              onClick={exportExcel}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>
            <button
              onClick={printView}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          <label className="text-xs text-gray-600">
            <span className="mb-1 block">Sales Rep Filter</span>
            <FilterMultiSelect
              label="Sales Rep"
              options={salesRepOptions}
              selected={selectedSalesReps}
              onChange={setSelectedSalesReps}
              fullWidth
              matchInputStyle
              showSelectedNames
            />
          </label>
          <label className="text-xs text-gray-600">
            <span className="mb-1 block">Customer Filter</span>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="Customer filter"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            />
          </label>
          <label className="text-xs text-gray-600">
            <span className="mb-1 block">Invoice# Filter</span>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="Invoice# filter"
              value={invoiceFilter}
              onChange={(e) => setInvoiceFilter(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
              {workingWeekLabel}
            </span>
            {displayedWeek?.status && (
              <span className="rounded-full border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-800">
                Status: {displayedWeek.status}
              </span>
            )}
          </div>
          <div className="mt-2 grid gap-2 text-xs text-blue-900 sm:grid-cols-2">
            <p>
              <span className="font-semibold">Week:</span> {weekRangeText}
            </p>
            <p>
              <span className="font-semibold">Check Date:</span> {checkDateText}
            </p>
          </div>
        </div>
        {mode === "main" &&
          !activeWeek &&
          !isRecordedViewMode &&
          showStartPanel && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
              <p className="text-sm font-medium text-amber-900">
                No active week is open.
              </p>
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
                <label className="text-xs text-amber-900">
                  <span className="mb-1 block">Week Start</span>
                  <input
                    type="date"
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                  />
                </label>
                <label className="text-xs text-amber-900">
                  <span className="mb-1 block">Week End</span>
                  <input
                    type="date"
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={weekEnd}
                    onChange={(e) => setWeekEnd(e.target.value)}
                  />
                </label>
                <label className="text-xs text-amber-900">
                  <span className="mb-1 block">Check Date</span>
                  <input
                    type="date"
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={checkDate}
                    onChange={(e) => setCheckDate(e.target.value)}
                  />
                </label>
              </div>
              <button
                onClick={startNewWeek}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-sm text-white"
              >
                <Plus className="h-3.5 w-3.5" /> Start Weekly Commission
              </button>
            </div>
          )}
        {message && <p className="mt-2.5 text-xs text-gray-700">{message}</p>}
      </div>

      <div className="hidden rounded-xl border border-gray-300 bg-white px-3 py-2 print:block">
        <div className="border-b border-gray-300 pb-1.5">
          <h2 className="text-[12px] font-bold tracking-[0.03em] text-gray-900">
            GM Design Commission on Sales
          </h2>
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-3 text-[10px] text-gray-800">
          <p className="rounded bg-gray-50 px-1.5 py-1">
            <span className="font-semibold">Period:</span> {weekRangeText}
          </p>
          <p className="rounded bg-gray-50 px-1.5 py-1">
            <span className="font-semibold">Check Date:</span> {checkDateText}
          </p>
          <p className="rounded bg-gray-50 px-1.5 py-1">
            <span className="font-semibold">Sales Rep:</span> {printSalesRep}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="commission-table print-compact-table min-w-full divide-y divide-gray-200 text-[11px]">
            <colgroup>
              <col style={{ width: "5%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "19%" }} />
              <col style={{ width: "3%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "7%" }} />
              <col className="print:hidden" style={{ width: "5%" }} />
            </colgroup>
            <thead className="bg-gray-100 text-[9px] uppercase tracking-[0.16em] text-gray-600">
              <tr>
                <th className="border-r px-2 py-2.5 text-center">Sales Rep</th>
                <th className="border-r px-2 py-2.5 text-center">Date</th>
                <th className="border-r px-2 py-2.5 text-center">Invoice#</th>
                <th className="border-r px-2 py-2.5 text-center">Customer</th>
                <th className="border-r px-2 py-2.5 text-center">% Cms</th>
                <th className="border-r px-2 py-2.5 text-center">Amount</th>
                <th className="border-r px-2 py-2.5 text-center">Total Cms</th>
                <th className="border-r px-2 py-2.5 text-center">
                  1st Payment
                </th>
                <th className="border-r px-2 py-2.5 text-center">3rd Party</th>
                <th className="border-r px-2 py-2.5 text-center">Refund</th>
                <th className="border-r px-2 py-2.5 text-center">
                  2nd Payment
                </th>
                <th className="border-r px-2 py-2.5 text-center">Notes</th>
                <th className="border-r px-2 py-2.5 text-center">Status</th>
                <th className="px-2 py-2.5 text-center print:hidden">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const duplicate =
                  (duplicates.get(row.invoiceNumber.trim()) ?? 0) > 1;
                const bg = getInvoiceRowBg(row, settings, duplicate);
                const baseCommission = calcCommission(
                  asNum(row.amount),
                  asNum(row.commissionRate),
                );
                const adjustedAmount =
                  asNum(row.amount) -
                  asNum(row.thirdPartyAmount) -
                  asNum(row.refundAmount);
                const hasAmountAdjustment =
                  Math.abs(adjustedAmount - asNum(row.amount)) > 0.009;
                const hasCommissionAdjustment =
                  (asNum(row.thirdPartyAmount) > 0 ||
                    asNum(row.refundAmount) > 0) &&
                  Math.abs(baseCommission - asNum(row.calculatedCommission)) >
                    0.009;
                const baseSecondPayment = parseFloat(
                  (
                    (baseCommission * asNum(settings.secondPaymentPercent)) /
                    100
                  ).toFixed(2),
                );
                const hasSecondAdjustment =
                  hasCommissionAdjustment &&
                  Math.abs(baseSecondPayment - asNum(row.secondPaymentAmount)) >
                    0.009;
                return (
                  <tr
                    key={row.id}
                    style={{
                      backgroundColor: bg,
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                    }}
                    className="divide-x divide-gray-200 border-t align-top"
                  >
                    <td className="px-2 py-1.5">
                      <input
                        className="w-16 rounded-md border px-2 py-1 text-[11px]"
                        value={row.salesRep}
                        onChange={(e) =>
                          updateRow(row.id, {
                            salesRep: e.target.value,
                            isNew: false,
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        className="w-[88px] rounded-md border px-1.5 py-1 text-[11px]"
                        value={row.invoiceDate?.slice(0, 10) ?? ""}
                        onChange={(e) =>
                          updateRow(row.id, {
                            invoiceDate: e.target.value,
                            isNew: false,
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <input
                          className={`w-[76px] rounded-md border px-1.5 py-1 text-[11px] ${duplicate ? "text-amber-800 font-semibold" : ""}`}
                          value={row.invoiceNumber}
                          onChange={(e) =>
                            updateRow(row.id, {
                              invoiceNumber: e.target.value,
                              isNew: false,
                            })
                          }
                        />
                        {row.invoiceNumber.trim() && (
                          <a
                            href={getQuickBooksInvoiceUrl(row.invoiceNumber)}
                            target="_blank"
                            rel="noreferrer"
                            className="print:hidden text-blue-600 hover:text-blue-700"
                            title="Open invoice in QuickBooks"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="w-[190px] rounded-md border px-2 py-1 text-[11px]"
                        value={row.customer}
                        onChange={(e) =>
                          updateRow(row.id, {
                            customer: e.target.value,
                            isNew: false,
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center rounded-md border bg-white overflow-hidden w-[58px]">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-9 px-1.5 py-1 text-[11px] outline-none [appearance:textfield]"
                          value={getNumericInputValue(row, "commissionRate")}
                          onChange={(e) =>
                            updateDecimalField(
                              row.id,
                              "commissionRate",
                              e.target.value,
                              false,
                            )
                          }
                          onBlur={() =>
                            commitDecimalField(row.id, "commissionRate", false)
                          }
                        />
                        <span className="border-l px-1.5 py-1 text-[11px] text-gray-500 bg-gray-50">
                          %
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center rounded-md border bg-white overflow-hidden w-[84px]">
                        <span className="border-r px-1.5 py-1 text-[11px] text-gray-500 bg-gray-50">
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-[56px] px-1.5 py-1 text-[11px] outline-none [appearance:textfield]"
                          value={getNumericInputValue(row, "amount")}
                          onChange={(e) =>
                            updateDecimalField(
                              row.id,
                              "amount",
                              e.target.value,
                              false,
                            )
                          }
                          onBlur={() =>
                            commitDecimalField(row.id, "amount", false)
                          }
                        />
                      </div>
                      {hasAmountAdjustment && (
                        <div className="mt-1 text-center leading-tight">
                          <div className="text-gray-400 line-through">
                            {formatCurrency(row.amount)}
                          </div>
                          <div className="font-semibold text-amber-700">
                            New: {formatCurrency(adjustedAmount)}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center font-medium">
                      {hasCommissionAdjustment ? (
                        <div className="leading-tight">
                          <div className="text-gray-400 line-through">
                            {formatCurrency(baseCommission)}
                          </div>
                          <div className="font-semibold text-amber-700">
                            New: {formatCurrency(row.calculatedCommission)}
                          </div>
                        </div>
                      ) : (
                        formatCurrency(row.calculatedCommission)
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <div className="print-payment-value font-medium">
                        {formatCurrency(row.firstPaymentAmount)}
                      </div>
                      {row.firstPaidDate && (
                        <div className="print-paid-date print-first-paid-date text-xs text-gray-600">
                          Paid {formatDate(row.firstPaidDate)}
                        </div>
                      )}
                      {!row.firstPaidDate && canEdit && (
                        <label className="print-pay-label mt-0.5 flex items-center justify-center gap-1.5 text-[10px]">
                          <input
                            type="checkbox"
                            checked={row.payFirst}
                            disabled={!canEdit}
                            onChange={(e) =>
                              updateRow(row.id, { payFirst: e.target.checked })
                            }
                          />{" "}
                          Pay
                        </label>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center rounded-md border bg-white overflow-hidden w-[72px]">
                        <span className="border-r px-1.5 py-1 text-[11px] text-gray-500 bg-gray-50">
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-[46px] px-1.5 py-1 text-[11px] outline-none [appearance:textfield]"
                          value={getNumericInputValue(row, "thirdPartyAmount")}
                          onChange={(e) =>
                            updateDecimalField(
                              row.id,
                              "thirdPartyAmount",
                              e.target.value,
                              true,
                            )
                          }
                          onBlur={() =>
                            commitDecimalField(row.id, "thirdPartyAmount", true)
                          }
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center rounded-md border bg-white overflow-hidden w-[72px]">
                        <span className="border-r px-1.5 py-1 text-[11px] text-gray-500 bg-gray-50">
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-[46px] px-1.5 py-1 text-[11px] outline-none [appearance:textfield]"
                          value={getNumericInputValue(row, "refundAmount")}
                          onChange={(e) =>
                            updateDecimalField(
                              row.id,
                              "refundAmount",
                              e.target.value,
                              true,
                            )
                          }
                          onBlur={() =>
                            commitDecimalField(row.id, "refundAmount", true)
                          }
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <div className="print-payment-value font-medium">
                        {hasSecondAdjustment ? (
                          <div className="leading-tight">
                            <div className="text-gray-400 line-through">
                              {formatCurrency(baseSecondPayment)}
                            </div>
                            <div className="font-semibold text-amber-700">
                              New: {formatCurrency(row.secondPaymentAmount)}
                            </div>
                          </div>
                        ) : (
                          formatCurrency(row.secondPaymentAmount)
                        )}
                      </div>
                      {row.secondPaidDate && (
                        <div className="print-paid-date text-xs text-gray-600">
                          Paid {formatDate(row.secondPaidDate)}
                        </div>
                      )}
                      {!row.secondPaidDate && canEdit && (
                        <label className="print-pay-label mt-0.5 flex items-center justify-center gap-1.5 text-[10px]">
                          <input
                            type="checkbox"
                            checked={row.paySecond}
                            disabled={
                              !canEdit || (!row.payFirst && !row.firstPaid)
                            }
                            onChange={(e) =>
                              updateRow(row.id, { paySecond: e.target.checked })
                            }
                          />
                          Pay
                        </label>
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {canEdit ? (
                        <div className="relative print:hidden">
                          <div className="mb-1 min-h-[20px] w-[128px] rounded-md border bg-white px-1.5 py-1 text-[10px] leading-tight text-gray-700">
                            {parseNoteReasons(row.notes).length > 0
                              ? parseNoteReasons(row.notes).join(", ")
                              : "No reasons"}
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenNotesRowId((prev) =>
                                  prev === row.id ? null : row.id,
                                )
                              }
                              className="rounded-md border px-2 py-1 text-[10px] font-medium text-gray-700"
                            >
                              + Add
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateRow(row.id, { notes: null, isNew: false })
                              }
                              className="rounded-md border px-2 py-1 text-[10px] text-gray-600"
                            >
                              Clear
                            </button>
                          </div>
                          {openNotesRowId === row.id && (
                            <div className="absolute left-0 top-[52px] z-20 w-[180px] rounded-lg border bg-white p-2 shadow-lg">
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                Select Reasons
                              </p>
                              <div className="max-h-32 space-y-1 overflow-auto pr-1">
                                {NOTE_REASON_OPTIONS.map((option) => {
                                  const selected = parseNoteReasons(
                                    row.notes,
                                  ).includes(option);
                                  return (
                                    <label
                                      key={option}
                                      className="flex items-center gap-1.5 text-[10px] text-gray-700"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={(e) => {
                                          const current = parseNoteReasons(
                                            row.notes,
                                          );
                                          const next = e.target.checked
                                            ? [...current, option]
                                            : current.filter(
                                                (value) => value !== option,
                                              );
                                          updateRow(row.id, {
                                            notes:
                                              next.length > 0
                                                ? next.join(" | ")
                                                : null,
                                            isNew: false,
                                          });
                                        }}
                                      />
                                      <span>{option}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              <button
                                type="button"
                                onClick={() => setOpenNotesRowId(null)}
                                className="mt-2 w-full rounded-md border px-2 py-1 text-[10px] font-medium text-gray-700"
                              >
                                Done
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-md border bg-white px-1.5 py-1 text-[10px] leading-tight text-gray-700 print:hidden">
                          {parseNoteReasons(row.notes).length > 0
                            ? parseNoteReasons(row.notes).join(", ")
                            : "No reasons"}
                        </div>
                      )}
                      <div className="hidden text-[10px] print:block">
                        {row.notes ?? ""}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-[11px] text-gray-700">
                      {rowDisplayStatus(row)}
                    </td>
                    <td className="px-2 py-1.5 print:hidden">
                      {canEdit && (
                        <button
                          onClick={() => removeRow(row.id)}
                          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]"
                        >
                          <Trash2 className="h-3 w-3" /> Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
          >
            <Plus className="h-3.5 w-3.5" /> Add Invoice
          </button>
          <button
            title="Mark Existing: when you carry invoices over from the previous week, they start highlighted as 'new'. Click this to clear that flag so only truly new invoices are highlighted."
            onClick={() =>
              setRows((prev) => prev.map((row) => ({ ...row, isNew: false })))
            }
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Mark Existing
            <span className="ml-0.5 text-[10px] text-gray-400">
              (hover for info)
            </span>
          </button>
          {mode === "review" ? (
            <>
              <button
                onClick={approveWeek}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-sm text-white"
              >
                <ArrowRight className="h-3.5 w-3.5" /> Approve
              </button>
              <button
                onClick={sendReviewBackToDraft}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800"
              >
                Back to Draft
              </button>
            </>
          ) : (
            <button
              onClick={sendToReview}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-sm text-white"
            >
              <ArrowRight className="h-3.5 w-3.5" /> Send to Review
            </button>
          )}
        </div>
      )}

      {/* ── Per-Rep Summary ── */}
      {repSummary.length > 0 && (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm print:border-0">
          <div className="border-b bg-gray-50 px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">
              Weekly Summary by Sales Rep
            </p>
          </div>
          <div className="summary-grid grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {repSummary.map(
              ({
                rep,
                invoiceAmount,
                monthSales,
                monthLabel,
                totalCms,
                commissionLeft,
                commissionThisWeek,
                minWageComplement,
                bonus,
                finalWeekPay,
              }) => (
                <div
                  key={rep}
                  className="summary-card rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <p className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-800">
                    {rep}
                  </p>
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex justify-between border-b pb-1">
                      <dt className="text-gray-500">Total Invoice Sales</dt>
                      <dd className="font-medium text-gray-900">
                        {formatCurrency(invoiceAmount)}
                      </dd>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <dt className="text-gray-500">
                        Total Sales for {monthLabel}
                      </dt>
                      <dd className="font-medium text-gray-900">
                        {formatCurrency(monthSales)}
                      </dd>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <dt className="text-gray-500">Total Commission</dt>
                      <dd className="font-medium text-gray-900">
                        {formatCurrency(totalCms)}
                      </dd>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <dt className="text-gray-500">Total Commission Left</dt>
                      <dd className="font-medium text-gray-900">
                        {formatCurrency(commissionLeft)}
                      </dd>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <dt className="text-gray-500">
                        Commission for This Week
                      </dt>
                      <dd className="font-medium text-gray-900">
                        {formatCurrency(commissionThisWeek)}
                      </dd>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <dt className="text-gray-500">
                        Complement to reach Min Wage by Law
                      </dt>
                      <dd className="font-medium text-gray-900">
                        {formatCurrency(minWageComplement)}
                      </dd>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <dt className="text-gray-500">Bonus</dt>
                      <dd className="font-medium text-gray-900">
                        {formatCurrency(bonus)}
                      </dd>
                    </div>
                    <div className="flex justify-between pt-1">
                      <dt className="font-semibold text-gray-800">
                        Final Week Pay
                      </dt>
                      <dd className="font-bold text-emerald-700">
                        {formatCurrency(finalWeekPay)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ),
            )}
          </div>
          <div className="flex flex-wrap gap-6 border-t bg-gray-50 px-4 py-3 text-xs">
            <span className="text-gray-500">
              Total Invoice Sales:{" "}
              <strong className="text-gray-900">
                {formatCurrency(overallInvoiceSales)}
              </strong>
            </span>
            <span className="text-gray-500">
              Commission This Week:{" "}
              <strong className="text-gray-900">
                {formatCurrency(overallCommissionThisWeek)}
              </strong>
            </span>
            <span className="text-gray-500">
              Bonus:{" "}
              <strong className="text-gray-900">
                {formatCurrency(overallBonus)}
              </strong>
            </span>
            <span className="text-gray-500">
              Min-Wage Complement:{" "}
              <strong className="text-gray-900">
                {formatCurrency(overallComplement)}
              </strong>
            </span>
            <span className="text-gray-500">
              Total Payroll:{" "}
              <strong className="text-emerald-700">
                {formatCurrency(overallFinalPayroll)}
              </strong>
            </span>
          </div>
        </div>
      )}

      <div className="hidden print:block">
        <div className="mb-1 text-[10px] text-gray-700">
          Printed by {initialUserName}
        </div>
      </div>

      <style jsx global>{`
        .sales-commission-print .commission-table th,
        .sales-commission-print .commission-table td {
          padding: 4px 5px !important;
          vertical-align: top;
        }
        .sales-commission-print .commission-table input,
        .sales-commission-print .commission-table select,
        .sales-commission-print .commission-table button {
          font-size: 11px !important;
        }
        @media print {
          @page {
            size: landscape;
            margin: 6mm;
          }
          .sales-commission-print,
          .sales-commission-print * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .sales-commission-print .overflow-x-auto {
            overflow: visible !important;
          }
          .sales-commission-print .print-compact-table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }
          .sales-commission-print .print-compact-table th:nth-child(2),
          .sales-commission-print .print-compact-table td:nth-child(2) {
            width: 5% !important;
          }
          .sales-commission-print .print-compact-table th:nth-child(3),
          .sales-commission-print .print-compact-table td:nth-child(3) {
            width: 4.5% !important;
          }
          .sales-commission-print .print-compact-table th:nth-child(4),
          .sales-commission-print .print-compact-table td:nth-child(4) {
            width: 20% !important;
          }
          .sales-commission-print .print-compact-table th:nth-child(5),
          .sales-commission-print .print-compact-table td:nth-child(5) {
            width: 2.5% !important;
          }
          .sales-commission-print .print-compact-table th:nth-child(6),
          .sales-commission-print .print-compact-table td:nth-child(6),
          .sales-commission-print .print-compact-table th:nth-child(8),
          .sales-commission-print .print-compact-table td:nth-child(8),
          .sales-commission-print .print-compact-table th:nth-child(9),
          .sales-commission-print .print-compact-table td:nth-child(9) {
            text-align: center !important;
          }
          .sales-commission-print .print-compact-table th,
          .sales-commission-print .print-compact-table td {
            padding: 0.9px 1.6px !important;
            font-size: 7.1px !important;
            line-height: 1.12 !important;
            font-family: Arial, sans-serif !important;
            white-space: nowrap !important;
            vertical-align: middle !important;
          }
          .sales-commission-print .print-compact-table td * {
            font-size: inherit !important;
            line-height: inherit !important;
            font-family: inherit !important;
          }
          .sales-commission-print .print-compact-table td:nth-child(6) > div,
          .sales-commission-print .print-compact-table td:nth-child(8) > div,
          .sales-commission-print .print-compact-table td:nth-child(9) > div {
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .sales-commission-print .print-compact-table td:nth-child(6) > div,
          .sales-commission-print .print-compact-table td:nth-child(8) > div,
          .sales-commission-print .print-compact-table td:nth-child(9) > div,
          .sales-commission-print .print-compact-table td:nth-child(6) > input,
          .sales-commission-print .print-compact-table td:nth-child(8) > input,
          .sales-commission-print .print-compact-table td:nth-child(9) > input {
            display: block !important;
          }
          .sales-commission-print .print-compact-table thead th {
            letter-spacing: 0.02em !important;
            font-size: 6.7px !important;
            font-weight: 700 !important;
          }
          .sales-commission-print
            .print-compact-table
            input:not([type="checkbox"]) {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            border: 0 !important;
            background: transparent !important;
            font-size: 7.1px !important;
            line-height: 1.12 !important;
            font-family: Arial, sans-serif !important;
            padding: 0 !important;
            margin: 0 !important;
            outline: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            appearance: none !important;
            -webkit-appearance: none !important;
          }
          .sales-commission-print .print-compact-table input[type="checkbox"] {
            width: 7px !important;
            height: 7px !important;
            min-width: 7px !important;
            max-width: 7px !important;
            margin: 0 !important;
            vertical-align: middle !important;
          }
          .sales-commission-print .print-compact-table label {
            font-size: 6.2px !important;
            line-height: 1 !important;
            gap: 1px !important;
            font-family: Arial, sans-serif !important;
          }
          .sales-commission-print .print-compact-table .print-pay-label {
            margin-top: 0 !important;
            padding-bottom: 0.6px !important;
          }
          .sales-commission-print .print-compact-table .print-payment-value {
            margin-top: 0.6px !important;
            margin-bottom: 0.3px !important;
            line-height: 1.05 !important;
          }
          .sales-commission-print .print-compact-table .print-paid-date {
            font-size: 6.1px !important;
            line-height: 1 !important;
            margin-top: 0.35px !important;
            white-space: nowrap !important;
          }
          .sales-commission-print .print-compact-table .print-first-paid-date {
            margin-top: 0.8px !important;
            line-height: 1.05 !important;
          }
          .sales-commission-print .print-compact-table td > div {
            border: 0 !important;
            background: transparent !important;
            width: auto !important;
            min-width: 0 !important;
            box-shadow: none !important;
            outline: 0 !important;
            border-radius: 0 !important;
          }
          .sales-commission-print .print-compact-table td > div > span {
            border: 0 !important;
            background: transparent !important;
            padding: 0 1px 0 0 !important;
          }
          .sales-commission-print .print-compact-table .print\:hidden {
            display: none !important;
          }
          .sales-commission-print .print-compact-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .sales-commission-print .summary-card {
            min-height: 220px;
          }
          @media print {
            .sales-commission-print .summary-grid {
              display: grid !important;
              grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
              gap: 6px !important;
              padding: 6px !important;
              align-items: start !important;
            }
            .sales-commission-print .summary-card {
              min-height: 150px !important;
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        }
      `}</style>

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 print:hidden">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b pb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Import CSV / Excel
                </h2>
                <p className="text-sm text-gray-500">
                  Download an empty template or a sample file before importing.
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="rounded-full border px-2 py-1 text-sm text-gray-600"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1.3fr_1fr]">
              <div className="rounded-xl border p-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => downloadTemplate(false)}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
                  >
                    Download Empty File
                  </button>
                  <button
                    onClick={() => downloadTemplate(true)}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    Download Sample File
                  </button>
                  <button
                    onClick={() => importInputRef.current?.click()}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
                  >
                    Choose File
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    className="hidden"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      importFile(file);
                      e.currentTarget.value = "";
                    }}
                  />
                </div>
                {importFileName ? (
                  <p className="mt-2 text-xs text-gray-600">
                    Selected file: {importFileName}
                  </p>
                ) : null}
                {importError ? (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    {importError}
                  </p>
                ) : null}
                <div className="mt-3 rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
                  <p className="font-medium text-gray-900">Required columns</p>
                  <p className="mt-1">
                    Sales Rep, Date, Invoice#, Customer, %Cms, Amount
                  </p>
                  <p className="mt-2 font-medium text-gray-900">
                    Optional columns
                  </p>
                  <p className="mt-1">
                    3rd Party, Refund, 1st Paid Date, 2nd Paid Date, Notes.
                    Fill in a Paid Date to import an invoice that was already
                    paid (in part or in full) without needing to update it in
                    the database afterward -- 1st/2nd Payment amounts are
                    always calculated automatically.
                  </p>
                </div>
                <div className="mt-3">
                  <button
                    onClick={confirmImportRows}
                    disabled={importPreviewRows.length === 0}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    Add {importPreviewRows.length} Invoice(s)
                  </button>
                </div>
              </div>

              <div className="rounded-xl border p-3 text-sm text-gray-700">
                <p className="font-medium text-gray-900">Import tips</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>
                    Use the sample file if you want to see the expected format.
                  </li>
                  <li>The empty file already includes the right headers.</li>
                  <li>
                    Rows are added to the bottom so the new work stays separate
                    from older entries.
                  </li>
                  <li>
                    Already paid an invoice outside the system? Set its 1st
                    Paid Date and/or 2nd Paid Date and it will import already
                    marked paid.
                  </li>
                  <li>You can still edit the values after import.</li>
                </ul>
              </div>
            </div>

            <div className="mt-3 rounded-xl border p-3">
              <p className="text-sm font-medium text-gray-900">
                Preview of invoices to be added
              </p>
              <div className="mt-2 max-h-48 overflow-auto rounded-lg border">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-100 text-left">
                    <tr>
                      <th className="px-2 py-1.5">Sales Rep</th>
                      <th className="px-2 py-1.5">Date</th>
                      <th className="px-2 py-1.5">Invoice#</th>
                      <th className="px-2 py-1.5">Customer</th>
                      <th className="px-2 py-1.5">%Cms</th>
                      <th className="px-2 py-1.5">Amount</th>
                      <th className="px-2 py-1.5">3rd Party</th>
                      <th className="px-2 py-1.5">Refund</th>
                      <th className="px-2 py-1.5">1st Paid</th>
                      <th className="px-2 py-1.5">2nd Paid</th>
                      <th className="px-2 py-1.5">Notes</th>
                      <th className="px-2 py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreviewRows.slice(0, 50).map((row, index) => (
                      <tr
                        key={`${row.invoiceNumber}-${index}`}
                        className="border-t"
                      >
                        <td className="px-2 py-1.5">{row.salesRep}</td>
                        <td className="px-2 py-1.5">{row.invoiceDate}</td>
                        <td className="px-2 py-1.5">{row.invoiceNumber}</td>
                        <td className="px-2 py-1.5">{row.customer}</td>
                        <td className="px-2 py-1.5">{row.commissionRate}</td>
                        <td className="px-2 py-1.5">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="px-2 py-1.5">
                          {row.thirdPartyAmount != null
                            ? formatCurrency(row.thirdPartyAmount)
                            : ""}
                        </td>
                        <td className="px-2 py-1.5">
                          {row.refundAmount != null
                            ? formatCurrency(row.refundAmount)
                            : ""}
                        </td>
                        <td className="px-2 py-1.5">
                          {row.firstPaidDate || ""}
                        </td>
                        <td className="px-2 py-1.5">
                          {row.secondPaidDate || ""}
                        </td>
                        <td className="px-2 py-1.5">{row.notes ?? ""}</td>
                        <td className="px-2 py-1.5">
                          {formatStatus(row.status)}
                        </td>
                      </tr>
                    ))}
                    {importPreviewRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={12}
                          className="px-2 py-2 text-center text-gray-500"
                        >
                          Choose a file to preview rows.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 print:hidden">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b pb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Review Weeks
                </h2>
                <p className="text-sm text-gray-500">
                  Approve a review week or send it back to draft.
                </p>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="rounded-full border px-2 py-1 text-sm text-gray-600"
              >
                Close
              </button>
            </div>
            <div className="mt-3 max-h-[55vh] space-y-3 overflow-auto">
              {reviewLoading && (
                <p className="text-sm text-gray-500">Loading review weeks...</p>
              )}
              {!reviewLoading && reviewWeeks.length === 0 && (
                <p className="rounded-xl border bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  No weeks currently in REVIEW status.
                </p>
              )}
              {!reviewLoading &&
                reviewWeeks.map((week) => (
                  <div key={week.id} className="rounded-xl border bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {formatDate(week.weekStart)} -{" "}
                          {formatDate(week.weekEnd)}
                        </p>
                        <p className="text-xs text-gray-600">
                          Check date: {formatDate(week.checkDate)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            router.push(`?viewWeekId=${week.id}`);
                            setShowReviewModal(false);
                          }}
                          className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700"
                          disabled={busy}
                        >
                          View
                        </button>
                        <button
                          onClick={() =>
                            updateReviewWeekStatus(week.id, "DRAFT")
                          }
                          className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700"
                          disabled={busy}
                        >
                          Send to Draft
                        </button>
                        <button
                          onClick={() =>
                            updateReviewWeekStatus(week.id, "APPROVED")
                          }
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700"
                          disabled={busy}
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

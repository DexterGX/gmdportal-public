"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  CheckCircle2,
  FileDown,
  FileUp,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { formatDateInput, resolvePayWeek } from "@/lib/salesCommission";
import type {
  CommissionInvoice,
  CommissionPeriod,
  NoteOption,
  SalesRepOption,
} from "./types";

type Notification = {
  type: "success" | "error" | "info";
  message: string;
};

type FilterState = {
  salesRepIds: string[];
  checkDate: string;
  clientName: string;
  invoiceNumber: string;
};

type AddInvoiceForm = {
  salesRepId: string;
  invoiceDate: string;
  invoiceNumber: string;
  customerName: string;
  commissionRate: string;
  invoiceAmount: string;
  notes: string;
};

type AddInvoiceErrors = Partial<Record<keyof AddInvoiceForm, string>>;

const defaultFilters: FilterState = {
  salesRepIds: [],
  checkDate: "",
  clientName: "",
  invoiceNumber: "",
};

const defaultAddInvoiceForm: AddInvoiceForm = {
  salesRepId: "",
  invoiceDate: formatDateInput(new Date()),
  invoiceNumber: "",
  customerName: "",
  commissionRate: "",
  invoiceAmount: "",
  notes: "",
};

const predefinedHolds = [
  "Missing client signature",
  "No deposit received",
  "Waiting final payment",
  "Refund applied",
  "Third party involved",
  "Credit memo",
  "Manual review needed",
  "Commission rate error",
  "Other",
];

function money(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n)
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "$0.00";
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function percent(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n}%` : "-";
}

function parseDateLike(value?: string | Date | null) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateOnly(value?: string | null) {
  if (!value) return "";
  const d = parseDateLike(value);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function displayDate(value?: string | Date | null) {
  if (!value) return "";
  const d = parseDateLike(value);
  if (!d) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}

function cleanNumeric(value: string) {
  return value.replace(/[^0-9.-]/g, "").trim();
}

function numberInputValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "";
  return n.toFixed(2);
}

function rowVisualState(row: CommissionInvoice) {
  const firstPayment = asNumber(
    row.firstPaymentNowOverride ?? row.firstPaymentNowCalculated,
  );
  const secondPayment = asNumber(
    row.secondPaymentNowOverride ?? row.secondPaymentNowCalculated,
  );
  const hasAdjustments =
    asNumber(row.refundAdjustment) > 0 ||
    asNumber(row.thirdPartyAdjustment) > 0;
  const hasHold =
    row.status === "HOLD" ||
    (row.notesOptionLabels || []).some((x) => x.toLowerCase().includes("hold"));
  const missingRequired =
    !row.customerName ||
    !row.commissionRate ||
    asNumber(row.invoiceAmount) <= 0;

  if (row.status === "CLOSED")
    return {
      rowClass: "bg-gray-100",
      label: "Closed",
      badgeClass: "bg-gray-200 text-gray-700",
    };
  if (missingRequired || row.status === "MANUAL_REVIEW")
    return {
      rowClass: "bg-red-50",
      label: "Review Required",
      badgeClass: "bg-red-100 text-red-700",
    };
  if (hasHold)
    return {
      rowClass: "bg-yellow-50",
      label: "Hold",
      badgeClass: "bg-yellow-100 text-yellow-800",
    };
  if (hasAdjustments)
    return {
      rowClass: "bg-orange-50",
      label: "Adjustment",
      badgeClass: "bg-orange-100 text-orange-700",
    };
  if (firstPayment > 0 && secondPayment > 0)
    return {
      rowClass: "bg-green-50",
      label: "Ready to Close",
      badgeClass: "bg-green-100 text-green-700",
    };
  if (firstPayment > 0)
    return {
      rowClass: "bg-blue-50",
      label: "First Paid",
      badgeClass: "bg-blue-100 text-blue-700",
    };
  return {
    rowClass: "bg-white",
    label: "Open",
    badgeClass: "bg-gray-100 text-gray-700",
  };
}

export default function SalesCommissionClient({
  appRole: _appRole,
}: {
  appRole: string;
}) {
  const [periods, setPeriods] = useState<CommissionPeriod[]>([]);
  const [invoices, setInvoices] = useState<CommissionInvoice[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRepOption[]>([]);
  const [noteOptions, setNoteOptions] = useState<NoteOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notification | null>(null);

  const [filterDraft, setFilterDraft] = useState<FilterState>(defaultFilters);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [showSalesRepFilter, setShowSalesRepFilter] = useState(false);

  const [showStartWeeklyModal, setShowStartWeeklyModal] = useState(false);
  const [weeklyDate, setWeeklyDate] = useState(formatDateInput(new Date()));
  const [weeklyScope, setWeeklyScope] = useState("ALL");

  const [showImportModal, setShowImportModal] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importMode, setImportMode] = useState<"preview" | "commit" | null>(
    null,
  );
  const [importPeriodId, setImportPeriodId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [importPreviewRows, setImportPreviewRows] = useState<any[]>([]);

  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);
  const [addInvoiceBusy, setAddInvoiceBusy] = useState(false);
  const [addInvoiceForm, setAddInvoiceForm] = useState<AddInvoiceForm>(
    defaultAddInvoiceForm,
  );
  const [addInvoiceErrors, setAddInvoiceErrors] = useState<AddInvoiceErrors>(
    {},
  );

  const [noteRow, setNoteRow] = useState<CommissionInvoice | null>(null);
  const [noteReasons, setNoteReasons] = useState<string[]>([]);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 3500);
    return () => clearTimeout(timer);
  }, [notification]);

  const weeklyPeriod = useMemo(
    () => resolvePayWeek(weeklyDate || new Date()),
    [weeklyDate],
  );
  const weeklyFromText = useMemo(
    () => displayDate(weeklyPeriod.start),
    [weeklyPeriod.start],
  );
  const weeklyToText = useMemo(
    () => displayDate(weeklyPeriod.end),
    [weeklyPeriod.end],
  );
  const weeklyCheckDateText = useMemo(
    () => displayDate(weeklyPeriod.checkDate),
    [weeklyPeriod.checkDate],
  );

  const checkDateOptions = useMemo(() => {
    const values = periods.map((p) => dateOnly(p.checkDate)).filter(Boolean);
    return Array.from(new Set(values));
  }, [periods]);

  const latestDraftPeriod = useMemo(() => {
    const drafts = periods.filter((period) => period.status === "DRAFT");
    if (!drafts.length) return null;
    return drafts.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0];
  }, [periods]);

  const displayedInvoices = useMemo(() => {
    if (!filters.salesRepIds.length) return invoices;
    return invoices.filter((inv) =>
      filters.salesRepIds.includes(inv.salesRepId || ""),
    );
  }, [invoices, filters.salesRepIds]);

  const summaryByRep = useMemo(() => {
    const map = new Map<
      string,
      {
        rep: string;
        sales: number;
        first: number;
        second: number;
        commission: number;
        bonus: number;
      }
    >();

    displayedInvoices.forEach((row) => {
      const rep =
        row.salesRepDisplay || row.salesRepInitialsRaw || "Unassigned";
      if (!map.has(rep)) {
        map.set(rep, {
          rep,
          sales: 0,
          first: 0,
          second: 0,
          commission: 0,
          bonus: 0,
        });
      }
      const item = map.get(rep)!;
      const first = asNumber(
        row.firstPaymentNowOverride ?? row.firstPaymentNowCalculated,
      );
      const second = asNumber(
        row.secondPaymentNowOverride ?? row.secondPaymentNowCalculated,
      );

      item.sales += asNumber(row.invoiceAmount);
      item.first += first;
      item.second += second;
      item.commission += first + second;
    });

    return Array.from(map.values()).sort((a, b) => a.rep.localeCompare(b.rep));
  }, [displayedInvoices]);

  const overall = useMemo(() => {
    return summaryByRep.reduce(
      (acc, row) => {
        acc.first += row.first;
        acc.second += row.second;
        acc.commission += row.commission;
        acc.bonus += row.bonus;
        return acc;
      },
      { first: 0, second: 0, commission: 0, bonus: 0 },
    );
  }, [summaryByRep]);

  const selectedSalesRepSummary = useMemo(() => {
    if (!filterDraft.salesRepIds.length) return "Any";
    if (filterDraft.salesRepIds.length === 1) {
      const only = salesReps.find(
        (rep) => rep.id === filterDraft.salesRepIds[0],
      );
      return only?.displayName || "1 selected";
    }
    return `${filterDraft.salesRepIds.length} selected`;
  }, [filterDraft.salesRepIds, salesReps]);

  async function loadBaseData() {
    setLoading(true);
    try {
      const [periodRes, settingsRes] = await Promise.all([
        fetch("/api/sales-commission/periods"),
        fetch("/api/sales-commission/settings"),
      ]);
      const periodData = await periodRes.json();
      const settingsData = await settingsRes.json();

      if (!periodRes.ok)
        throw new Error(periodData.error || "Failed to load periods");
      if (!settingsRes.ok)
        throw new Error(settingsData.error || "Failed to load settings");

      setPeriods(periodData.periods || []);
      setSalesReps(
        (settingsData.salesReps || []).filter((x: SalesRepOption) => x.active),
      );
      setNoteOptions(
        (settingsData.noteOptions || []).filter((x: NoteOption) => x.isActive),
      );
    } catch (error: any) {
      setNotification({
        type: "error",
        message: error?.message || "Failed to load page",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadInvoices(active: FilterState) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("includeClosed", "0");
      if (active.checkDate) params.set("checkDate", active.checkDate);
      if (active.clientName.trim())
        params.set("client", active.clientName.trim());
      if (active.invoiceNumber.trim())
        params.set("invoice", active.invoiceNumber.trim());

      const res = await fetch(
        `/api/sales-commission/invoices?${params.toString()}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load invoices");
      setInvoices(data.invoices || []);
    } catch (error: any) {
      setNotification({
        type: "error",
        message: error?.message || "Failed to load invoices",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBaseData();
    loadInvoices(defaultFilters);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFilters(filterDraft);
      loadInvoices(filterDraft);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [filterDraft]);

  async function clearFilters() {
    setFilterDraft(defaultFilters);
    setFilters(defaultFilters);
    await loadInvoices(defaultFilters);
  }

  function weekMondayLabelFromCheckDate(value?: string | null) {
    if (!value) return "";
    const d = parseDateLike(value);
    if (!d) return "";
    const day = d.getDay();
    const deltaToMonday = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - deltaToMonday);
    return displayDate(d);
  }

  async function savePaymentRow(
    row: CommissionInvoice,
    part: "first" | "second",
    inputValue: string,
    totalCommission: number,
    firstPaymentCurrent: number,
  ) {
    const typedValue = asNumber(cleanNumeric(inputValue) || 0);
    const safeTyped = Math.max(0, typedValue);

    let firstPaymentNow = firstPaymentCurrent;
    let secondPaymentNow = asNumber(
      row.secondPaymentNowOverride ?? row.secondPaymentNowCalculated,
    );

    if (part === "first") {
      firstPaymentNow = safeTyped;
      secondPaymentNow = Math.max(
        0,
        toMoneyRound(totalCommission - firstPaymentNow),
      );
      if (
        Math.abs(
          secondPaymentNow -
            asNumber(
              row.secondPaymentNowOverride ?? row.secondPaymentNowCalculated,
            ),
        ) > 0.009
      ) {
        setNotification({
          type: "info",
          message:
            "Second payment was auto-adjusted to match total commission.",
        });
      }
    } else {
      const expectedSecond = Math.max(
        0,
        toMoneyRound(totalCommission - firstPaymentCurrent),
      );
      if (Math.abs(safeTyped - expectedSecond) > 0.009) {
        secondPaymentNow = expectedSecond;
        setNotification({
          type: "info",
          message: `2nd payment was adjusted to ${money(expectedSecond)}.`,
        });
      } else {
        secondPaymentNow = safeTyped;
      }
    }

    await updateRow(row.id, {
      firstPaymentNow,
      secondPaymentNow,
    });
  }

  function toMoneyRound(value: number) {
    return Math.round(value * 100) / 100;
  }

  async function updateRow(
    invoiceId: string,
    updates: Record<string, unknown>,
  ) {
    setSavingRowId(invoiceId);
    try {
      const res = await fetch("/api/sales-commission/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed saving row");

      setInvoices((prev) =>
        prev.map((row) => (row.id === invoiceId ? data.invoice : row)),
      );
      setNotification({ type: "success", message: "Row saved." });
    } catch (error: any) {
      setNotification({
        type: "error",
        message: error?.message || "Failed saving row",
      });
    } finally {
      setSavingRowId(null);
    }
  }

  async function deleteRow(invoiceId: string) {
    if (!window.confirm("Delete this row from current workspace?")) return;
    try {
      const res = await fetch(
        `/api/sales-commission/invoices?invoiceId=${encodeURIComponent(invoiceId)}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete row");

      setInvoices((prev) => prev.filter((row) => row.id !== invoiceId));
      setNotification({ type: "success", message: "Row deleted." });
    } catch (error: any) {
      setNotification({
        type: "error",
        message: error?.message || "Failed to delete row",
      });
    }
  }

  async function startWeeklyCommission() {
    try {
      const res = await fetch("/api/sales-commission/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedDate: weeklyDate,
          salesRepScope: weeklyScope,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to start weekly commission");

      setShowStartWeeklyModal(false);
      await loadBaseData();
      setNotification({
        type: "success",
        message:
          "Weekly commission draft created. Main list remains on all open invoices.",
      });
    } catch (error: any) {
      setNotification({
        type: "error",
        message: error?.message || "Failed to start weekly commission",
      });
    }
  }

  function openNotesEditor(row: CommissionInvoice) {
    setNoteRow(row);
    setNoteReasons([...(row.notesOptionLabels || [])]);
    setNoteText(row.notesFreeText || "");
  }

  async function saveNotesEditor() {
    if (!noteRow) return;
    await updateRow(noteRow.id, {
      notesOptionLabels: noteReasons,
      notesFreeText: noteText,
      status: noteReasons.length > 0 ? "HOLD" : noteRow.status,
    });
    setNoteRow(null);
  }

  function buildImportInstructions() {
    return [
      "Commission Rate must be entered as 7.5, not 0.075.",
      "Dates can be Excel date cells or common date text formats.",
      "Money values should be numeric and do not require $ symbols.",
      "QuickBooks Transaction ID should be a text-safe numeric ID.",
      "Preview all rows before saving.",
    ];
  }

  async function ensureDraftPeriodForImport() {
    if (importPeriodId) return importPeriodId;

    const res = await fetch("/api/sales-commission/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedDate: formatDateInput(new Date()),
        salesRepScope: "ALL",
      }),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || "Failed to create weekly draft for import");

    const periodId = String(data.period?.id || "");
    if (!periodId) throw new Error("Weekly draft was not returned by API");

    setImportPeriodId(periodId);
    await loadBaseData();
    return periodId;
  }

  async function previewImport(file: File) {
    setImportBusy(true);
    setImportMode("preview");
    try {
      const periodId = await ensureDraftPeriodForImport();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
        raw: true,
      });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 120000);

      const res = await fetch("/api/sales-commission/import-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ periodId, rows }),
      });
      window.clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed import preview");

      setImportPreview(data);
      setImportPreviewRows(data.previewRows || []);
    } catch (error: any) {
      setNotification({
        type: "error",
        message:
          error?.name === "AbortError"
            ? "Import preview timed out. Please retry with a smaller file."
            : error?.message || "Failed import preview",
      });
    } finally {
      setImportBusy(false);
      setImportMode(null);
    }
  }

  async function commitImport() {
    if (!importPreview) return;
    setImportBusy(true);
    setImportMode("commit");
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 180000);

      const res = await fetch("/api/sales-commission/import-commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          periodId: importPeriodId,
          rows: importPreviewRows,
          preserveManualOverrides: true,
        }),
      });
      window.clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      await loadInvoices(filters);
      setImportPeriodId(null);
      setImportPreview(null);
      setImportPreviewRows([]);
      setShowImportModal(false);

      const warning = data.quickbooksTxnIdConflictRows
        ? ` ${data.quickbooksTxnIdConflictRows} QB txn IDs were kept unchanged due to conflicts.`
        : "";

      setNotification({
        type: "success",
        message: `Import complete. Created ${data.created}, updated ${data.updated}.${warning}`,
      });
    } catch (error: any) {
      setNotification({
        type: "error",
        message:
          error?.name === "AbortError"
            ? "Import commit timed out. Please retry; the server now processes imports in bulk for faster completion."
            : error?.message || "Import failed",
      });
    } finally {
      setImportBusy(false);
      setImportMode(null);
    }
  }

  async function downloadSample(format: "xlsx" | "csv") {
    try {
      const res = await fetch(
        `/api/sales-commission/import-sample?format=${format}`,
      );
      if (!res.ok) throw new Error("Failed to download sample file");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        format === "xlsx"
          ? "Sales-Commission-Import-Sample.xlsx"
          : "Sales-Commission-Import-Sample.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      setNotification({
        type: "error",
        message: error?.message || "Failed to download sample",
      });
    }
  }

  async function exportOpenInvoices() {
    try {
      const params = new URLSearchParams();
      params.set("includeClosed", "0");
      if (filters.checkDate) params.set("checkDate", filters.checkDate);
      if (filters.clientName.trim())
        params.set("client", filters.clientName.trim());
      if (filters.invoiceNumber.trim())
        params.set("invoice", filters.invoiceNumber.trim());

      const res = await fetch(
        `/api/sales-commission/export?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Failed to export open invoices");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Sales-Commission-Open-Invoices-${formatDateInput(new Date())}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      setNotification({
        type: "error",
        message: error?.message || "Failed to export open invoices",
      });
    }
  }

  function validateAddInvoiceForm(values: AddInvoiceForm): AddInvoiceErrors {
    const errors: AddInvoiceErrors = {};
    if (!values.invoiceNumber.trim())
      errors.invoiceNumber = "Invoice number is required";
    if (!values.customerName.trim())
      errors.customerName = "Customer name is required";
    if (!values.invoiceDate.trim())
      errors.invoiceDate = "Invoice date is required";
    if (!values.invoiceAmount.trim() || asNumber(values.invoiceAmount) <= 0) {
      errors.invoiceAmount = "Invoice amount must be greater than 0";
    }
    return errors;
  }

  function focusFirstAddInvoiceField(errors: AddInvoiceErrors) {
    const order: (keyof AddInvoiceForm)[] = [
      "invoiceNumber",
      "customerName",
      "invoiceDate",
      "invoiceAmount",
    ];
    const field = order.find((key) => !!errors[key]);
    if (!field) return;
    const el = document.querySelector<HTMLInputElement>(
      `[data-add-field="${field}"]`,
    );
    el?.focus();
  }

  async function submitAddInvoice() {
    const errors = validateAddInvoiceForm(addInvoiceForm);
    setAddInvoiceErrors(errors);

    const firstField = Object.keys(errors)[0] as
      | keyof AddInvoiceForm
      | undefined;
    if (firstField) {
      focusFirstAddInvoiceField(errors);
      return;
    }

    setAddInvoiceBusy(true);
    try {
      const selectedRep = salesReps.find(
        (rep) => rep.id === addInvoiceForm.salesRepId,
      );
      const res = await fetch("/api/sales-commission/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesRepId: addInvoiceForm.salesRepId || null,
          salesRepDisplay: selectedRep?.displayName || null,
          salesRepInitialsRaw: selectedRep?.quickbooksInitials || null,
          invoiceDate: addInvoiceForm.invoiceDate,
          invoiceNumber: addInvoiceForm.invoiceNumber.trim(),
          customerName: addInvoiceForm.customerName.trim(),
          commissionRate: addInvoiceForm.commissionRate.trim() || null,
          invoiceAmount: addInvoiceForm.invoiceAmount.trim(),
          notesFreeText: addInvoiceForm.notes.trim() || null,
          status:
            !addInvoiceForm.salesRepId || !addInvoiceForm.commissionRate.trim()
              ? "MANUAL_REVIEW"
              : "OPEN",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.error === "VALIDATION_ERROR" && data?.fields) {
          setAddInvoiceErrors(data.fields);
          focusFirstAddInvoiceField(data.fields);
          return;
        }
        throw new Error(data.error || "Failed to create invoice");
      }

      setShowAddInvoiceModal(false);
      setAddInvoiceForm(defaultAddInvoiceForm);
      setAddInvoiceErrors({});
      await loadInvoices(filters);
      setNotification({
        type: "success",
        message: "Invoice created successfully.",
      });
    } catch (error: any) {
      setNotification({
        type: "error",
        message: error?.message || "Failed to create invoice",
      });
    } finally {
      setAddInvoiceBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {notification && (
        <div className="fixed right-4 top-4 z-[120]">
          <div
            className={`rounded-lg border px-4 py-2 text-sm shadow ${
              notification.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : notification.type === "info"
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {notification.message}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Sales Commission
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Open and incomplete invoice workspace.
          </p>
          <div className="mt-1 text-xs text-gray-600">
            {latestDraftPeriod ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                Draft Period: {displayDate(latestDraftPeriod.startDate)} -{" "}
                {displayDate(latestDraftPeriod.endDate)} (
                {latestDraftPeriod.status})
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">
                No active draft period
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowStartWeeklyModal(true)}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            Start Weekly Commission
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            <FileUp className="h-4 w-4" />
            Import CSV/Excel
          </button>
          <button
            type="button"
            onClick={exportOpenInvoices}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            <FileDown className="h-4 w-4" />
            Export Open Invoices
          </button>
          <button
            type="button"
            onClick={() => setShowAddInvoiceModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm text-white hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            Add Invoice
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative text-xs font-medium text-gray-600 dark:text-gray-300">
            Sales Rep
            <button
              type="button"
              onClick={() => setShowSalesRepFilter((v) => !v)}
              className="mt-1 flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-left text-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900"
            >
              <span>{selectedSalesRepSummary}</span>
              <span className="text-gray-500">▾</span>
            </button>
            {showSalesRepFilter && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-900">
                {salesReps.length === 0 && (
                  <div className="px-1 py-1 text-xs text-gray-400">
                    No reps available
                  </div>
                )}
                {salesReps.map((rep) => (
                  <label
                    key={rep.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={filterDraft.salesRepIds.includes(rep.id)}
                      onChange={(e) =>
                        setFilterDraft((p) => ({
                          ...p,
                          salesRepIds: e.target.checked
                            ? [...p.salesRepIds, rep.id]
                            : p.salesRepIds.filter((id) => id !== rep.id),
                        }))
                      }
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                    />
                    <span className="whitespace-nowrap">{rep.displayName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Check Date
            <select
              value={filterDraft.checkDate}
              onChange={(e) =>
                setFilterDraft((p) => ({ ...p, checkDate: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            >
              <option value="">All</option>
              {checkDateOptions.map((d) => (
                <option key={d} value={d}>
                  {displayDate(d)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Client Name
            <input
              value={filterDraft.clientName}
              onChange={(e) =>
                setFilterDraft((p) => ({ ...p, clientName: e.target.value }))
              }
              placeholder="Search Client"
              className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </label>

          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Invoice #
            <input
              value={filterDraft.invoiceNumber}
              onChange={(e) =>
                setFilterDraft((p) => ({ ...p, invoiceNumber: e.target.value }))
              }
              placeholder="Search Invoice"
              className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-3 py-2 text-xs font-medium text-gray-600">
          Total Rows: {displayedInvoices.length}
        </div>
        <table className="w-full table-fixed text-[11px] leading-4">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
            <tr>
              <th
                style={{ width: "3%" }}
                className="border-r border-gray-200 px-1.5 py-2 text-center text-[11px] font-semibold text-gray-700"
              >
                #
              </th>
              <th
                style={{ width: "6.5%" }}
                className="border-r border-gray-200 px-1.5 py-2 text-center text-[11px] font-semibold text-gray-700"
              >
                Salesperson
              </th>
              <th
                style={{ width: "6.5%" }}
                className="border-r border-gray-200 px-1.5 py-2 text-center text-[11px] font-semibold text-gray-700"
              >
                Date
              </th>
              <th
                style={{ width: "5%" }}
                className="border-r border-gray-200 px-1.5 py-2 text-center text-[11px] font-semibold text-gray-700"
              >
                Invoice #
              </th>
              <th
                style={{ width: "14%" }}
                className="border-r border-gray-200 px-1.5 py-2 text-center text-[11px] font-semibold text-gray-700"
              >
                Customer Name
              </th>
              <th
                style={{ width: "3.5%" }}
                className="border-r border-gray-200 px-1.5 py-1 text-center text-[10px] font-semibold text-gray-700"
              >
                <span className="block leading-3">%</span>
                <span className="block leading-3">Cms</span>
              </th>
              <th
                style={{ width: "6.5%" }}
                className="border-r border-gray-200 px-1.5 py-2 text-center text-[11px] font-semibold text-gray-700"
              >
                Inv Amount
              </th>
              <th
                style={{ width: "6.5%" }}
                className="border-r border-gray-200 px-1.5 py-2 text-center text-[11px] font-semibold text-gray-700"
              >
                Total Comm
              </th>
              <th
                style={{ width: "5%" }}
                className="border-r border-gray-200 px-1.5 py-2 text-center text-[11px] font-semibold text-gray-700"
              >
                1st 60%
              </th>
              <th
                style={{ width: "6.5%" }}
                className="border-r border-gray-200 px-1.5 py-2 text-center text-[11px] font-semibold text-gray-700"
              >
                1st Payment
              </th>
              <th
                style={{ width: "5%" }}
                className="border-r border-gray-200 px-1.5 py-2 text-center text-[11px] font-semibold text-gray-700"
              >
                3rd Party
              </th>
              <th
                style={{ width: "5%" }}
                className="border-r border-gray-200 px-1.5 py-2 text-center text-[11px] font-semibold text-gray-700"
              >
                Refund
              </th>
              <th
                style={{ width: "5%" }}
                className="border-r border-gray-200 px-1.5 py-2 text-center text-[11px] font-semibold text-gray-700"
              >
                2nd 40%
              </th>
              <th
                style={{ width: "6.5%" }}
                className="border-r border-gray-200 px-1.5 py-2 text-center text-[11px] font-semibold text-gray-700"
              >
                2nd Payment
              </th>
              <th
                style={{ width: "8%" }}
                className="border-r border-gray-200 px-1.5 py-2 text-center text-[11px] font-semibold text-gray-700"
              >
                Notes
              </th>
              <th
                style={{ width: "7%" }}
                className="border-r border-gray-200 px-1.5 py-2 text-center text-[11px] font-semibold text-gray-700"
              >
                Status
              </th>
              <th
                style={{ width: "5%" }}
                className="px-1.5 py-2 text-center text-[11px] font-semibold text-gray-700"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedInvoices.map((row, rowIndex) => {
              const visual = rowVisualState(row);
              const totalCommission = asNumber(
                row.totalCommissionOverride ?? row.totalCommissionCalculated,
              );
              const firstCommission = asNumber(
                row.firstCommissionOverride ?? row.firstCommissionCalculated,
              );
              const secondCommission = asNumber(
                row.secondCommissionOverride ?? row.secondCommissionCalculated,
              );
              const secondAdjusted = asNumber(
                row.adjustedSecondCommissionCalculated,
              );
              const hasAdjustment =
                asNumber(row.refundAdjustment) > 0 ||
                asNumber(row.thirdPartyAdjustment) > 0;
              const periodLocked = row.period?.status === "FINALIZED";
              const periodCheckDate = row.period?.checkDate
                ? weekMondayLabelFromCheckDate(row.period.checkDate)
                : null;
              const firstPayValue = asNumber(
                row.firstPaymentNowOverride ?? row.firstPaymentNowCalculated,
              );
              const secondPayValue = asNumber(
                row.secondPaymentNowOverride ?? row.secondPaymentNowCalculated,
              );
              const firstPaymentComplete =
                firstPayValue > 0 &&
                Math.abs(firstPayValue - firstCommission) <= 0.009;
              const secondPaymentStarted = secondPayValue > 0;
              const statusBadgeLabel =
                row.status === "HOLD"
                  ? "Hold"
                  : row.status === "MANUAL_REVIEW"
                    ? "Review Required"
                    : secondPaymentStarted
                      ? "Second Payment"
                      : firstPayValue > 0
                        ? firstPaymentComplete
                          ? "First Paid"
                          : "First Payment"
                        : visual.label;

              return (
                <tr
                  key={row.id}
                  className={`border-b border-gray-100 align-top ${visual.rowClass}`}
                >
                  <td className="border-r border-gray-200 px-1 py-1 text-center font-semibold text-gray-500">
                    {rowIndex + 1}
                  </td>
                  <td className="border-r border-gray-200 px-1 py-1 text-left">
                    <select
                      value={row.salesRepId || ""}
                      onChange={(e) => {
                        const rep = salesReps.find(
                          (r) => r.id === e.target.value,
                        );
                        updateRow(row.id, {
                          salesRepId: e.target.value || null,
                          salesRepDisplay: rep?.displayName || null,
                          salesRepInitialsRaw: rep?.quickbooksInitials || null,
                        });
                      }}
                      className="w-full rounded border border-gray-300 px-1 py-1"
                    >
                      <option value="">Unassigned</option>
                      {salesReps.map((rep) => (
                        <option key={rep.id} value={rep.id}>
                          {rep.displayName}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="border-r border-gray-200 px-1 py-1 text-center">
                    <input
                      type="date"
                      defaultValue={dateOnly(row.invoiceDate)}
                      onBlur={(e) =>
                        updateRow(row.id, {
                          invoiceDate: e.target.value || null,
                        })
                      }
                      className="w-full rounded border border-gray-300 px-1 py-1 text-[10px] text-center"
                    />
                  </td>

                  <td className="border-r border-gray-200 px-1 py-1 text-center">
                    <input
                      defaultValue={row.invoiceNumber || ""}
                      onBlur={(e) =>
                        updateRow(row.id, {
                          invoiceNumber: e.target.value || null,
                        })
                      }
                      className="w-full rounded border border-gray-300 px-1 py-1 text-center"
                    />
                  </td>

                  <td className="border-r border-gray-200 px-1 py-1 text-left">
                    <input
                      defaultValue={row.customerName || ""}
                      onBlur={(e) =>
                        updateRow(row.id, { customerName: e.target.value })
                      }
                      className="w-full rounded border border-gray-300 px-1 py-1"
                    />
                  </td>

                  <td className="border-r border-gray-200 px-1 py-1 text-center">
                    <div className="flex items-center rounded border border-gray-300 px-1">
                      <input
                        defaultValue={String(row.commissionRate ?? "")}
                        onBlur={(e) =>
                          updateRow(row.id, {
                            commissionRate:
                              cleanNumeric(e.target.value) || null,
                          })
                        }
                        className="w-full py-1 text-center outline-none"
                      />
                      <span className="text-gray-500">%</span>
                    </div>
                  </td>

                  <td className="border-r border-gray-200 px-1 py-1 text-center">
                    <div className="flex items-center rounded border border-gray-300 px-1">
                      <span className="text-gray-500">$</span>
                      <input
                        defaultValue={numberInputValue(row.invoiceAmount)}
                        onBlur={(e) =>
                          updateRow(row.id, {
                            invoiceAmount: cleanNumeric(e.target.value) || null,
                          })
                        }
                        className="w-full py-1 text-center outline-none"
                      />
                    </div>
                  </td>

                  <td className="border-r border-gray-200 px-1 py-1 text-center">
                    {money(totalCommission)}
                  </td>

                  <td className="border-r border-gray-200 px-1 py-1 text-center">
                    {money(firstCommission)}
                  </td>

                  <td className="border-r border-gray-200 px-1 py-1 text-center">
                    {periodLocked ? (
                      <div>
                        <div className="font-medium">
                          {money(firstPayValue)}
                        </div>
                        {firstPayValue > 0 && periodCheckDate && (
                          <div className="text-[9px] text-blue-600">
                            Paid {periodCheckDate}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center rounded border border-gray-300 px-1">
                          <span className="text-gray-500">$</span>
                          <input
                            defaultValue={numberInputValue(firstPayValue)}
                            onBlur={(e) =>
                              savePaymentRow(
                                row,
                                "first",
                                e.target.value,
                                totalCommission,
                                firstPayValue,
                              )
                            }
                            className="w-full py-1 text-center outline-none"
                          />
                        </div>
                        {firstPayValue > 0 && periodCheckDate && (
                          <div className="text-[9px] text-center text-blue-600">
                            Paid {periodCheckDate}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="border-r border-gray-200 px-1 py-1 text-center">
                    <div className="flex items-center rounded border border-gray-300 px-1">
                      <span className="text-gray-500">$</span>
                      <input
                        defaultValue={numberInputValue(
                          row.thirdPartyAdjustment,
                        )}
                        onBlur={(e) =>
                          updateRow(row.id, {
                            thirdPartyAdjustment:
                              cleanNumeric(e.target.value) || null,
                          })
                        }
                        className="w-full py-1 text-center outline-none"
                      />
                    </div>
                  </td>

                  <td className="border-r border-gray-200 px-1 py-1 text-center">
                    <div className="flex items-center rounded border border-gray-300 px-1">
                      <span className="text-gray-500">$</span>
                      <input
                        defaultValue={numberInputValue(row.refundAdjustment)}
                        onBlur={(e) =>
                          updateRow(row.id, {
                            refundAdjustment:
                              cleanNumeric(e.target.value) || null,
                          })
                        }
                        className="w-full py-1 text-center outline-none"
                      />
                    </div>
                  </td>

                  <td className="border-r border-gray-200 px-1 py-1 text-center">
                    {!hasAdjustment ? (
                      <div>{money(secondCommission)}</div>
                    ) : (
                      <div>
                        <div className="text-gray-500 line-through">
                          {money(secondCommission)}
                        </div>
                        <div className="text-orange-700">
                          New: {money(secondAdjusted)}
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="border-r border-gray-200 px-1 py-1 text-center">
                    {periodLocked ? (
                      <div>
                        <div className="font-medium">
                          {money(secondPayValue)}
                        </div>
                        {secondPayValue > 0 && periodCheckDate && (
                          <div className="text-[9px] text-blue-600">
                            Paid {periodCheckDate}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center rounded border border-gray-300 px-1">
                          <span className="text-gray-500">$</span>
                          <input
                            defaultValue={numberInputValue(secondPayValue)}
                            onBlur={(e) =>
                              savePaymentRow(
                                row,
                                "second",
                                e.target.value,
                                totalCommission,
                                firstPayValue,
                              )
                            }
                            className="w-full py-1 text-center outline-none"
                          />
                        </div>
                        {secondPayValue > 0 && periodCheckDate && (
                          <div className="text-[9px] text-center text-blue-600">
                            Paid {periodCheckDate}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="border-r border-gray-200 px-1 py-1 text-left">
                    <div className="mb-1 flex flex-wrap gap-1">
                      {(row.notesOptionLabels || [])
                        .slice(0, 2)
                        .map((label) => (
                          <span
                            key={label}
                            className="inline-flex rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] text-yellow-800"
                          >
                            {label}
                          </span>
                        ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => openNotesEditor(row)}
                      className="rounded border border-gray-300 px-1.5 py-1 text-[10px] hover:bg-gray-50"
                    >
                      {row.notesOptionLabels?.length
                        ? "Edit Hold/Note"
                        : "Add Hold/Note"}
                    </button>
                  </td>

                  <td className="border-r border-gray-200 px-1 py-1 text-center">
                    <div
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${visual.badgeClass}`}
                    >
                      {statusBadgeLabel}
                    </div>
                    {secondPaymentStarted &&
                      row.status !== "HOLD" &&
                      row.status !== "MANUAL_REVIEW" && (
                        <div className="mt-0.5 text-[9px] font-semibold tracking-wide text-blue-600">
                          CLOSING
                        </div>
                      )}
                    <select
                      value={row.status}
                      onChange={(e) =>
                        updateRow(row.id, { status: e.target.value })
                      }
                      className="mt-1 w-full rounded border border-gray-300 px-1 py-1 text-center"
                    >
                      {[
                        "OPEN",
                        "HOLD",
                        "FIRST_PAID",
                        "SECOND_PAID",
                        "CLOSED",
                        "MANUAL_REVIEW",
                      ].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-1 py-1 text-center">
                    <div className="flex justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateRow(row.id, {})}
                        className="inline-flex items-center rounded border border-gray-300 px-1.5 py-1 hover:bg-gray-50"
                      >
                        {savingRowId === row.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow(row.id)}
                        className="inline-flex items-center rounded border border-red-300 px-1.5 py-1 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {!loading && displayedInvoices.length === 0 && (
              <tr>
                <td
                  colSpan={17}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No open or incomplete invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Weekly Summary by Sales Rep
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summaryByRep.map((row) => (
            <div
              key={row.rep}
              className="rounded-xl border border-gray-200 bg-white p-3"
            >
              <div className="mb-2 text-sm font-semibold text-gray-900">
                {row.rep}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Total Invoice Sales</span>
                  <span>{money(row.sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>1st Payments This Week</span>
                  <span>{money(row.first)}</span>
                </div>
                <div className="flex justify-between">
                  <span>2nd Payments This Week</span>
                  <span>{money(row.second)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Commission This Week</span>
                  <span>{money(row.commission)}</span>
                </div>
                <div className="flex justify-between rounded bg-green-50 px-2 py-1">
                  <span>Bonus This Week</span>
                  <span>{money(row.bonus)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t pt-2 text-sm font-semibold">
                  <span>Final Pay</span>
                  <span className="text-green-700">
                    {money(row.commission + row.bonus)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="mb-2 text-sm font-semibold text-gray-900">
            Overall Payroll Summary
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-4">
            <div className="rounded border border-gray-200 p-2">
              Total First Payments: {money(overall.first)}
            </div>
            <div className="rounded border border-gray-200 p-2">
              Total Second Payments: {money(overall.second)}
            </div>
            <div className="rounded border border-gray-200 p-2">
              Total Commission: {money(overall.commission)}
            </div>
            <div className="rounded border border-gray-200 p-2 font-semibold">
              Total Final Payroll: {money(overall.commission + overall.bonus)}
            </div>
          </div>
        </div>
      </div>

      {showStartWeeklyModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Start Weekly Commission
                </h2>
                <p className="text-sm text-gray-500">
                  Choose a date inside the commission week you want to draft.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStartWeeklyModal(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="block text-xs text-gray-600">
              Commission Week Date
              <input
                type="date"
                value={weeklyDate}
                onChange={(e) => setWeeklyDate(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              />
            </label>

            <div className="rounded border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 text-xs font-semibold text-gray-700">
                Commission Period
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-600">
                  From
                  <input
                    value={weeklyFromText}
                    disabled
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-700"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  To
                  <input
                    value={weeklyToText}
                    disabled
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-700"
                  />
                </label>
              </div>
            </div>

            <label className="block text-xs text-gray-600">
              Sales Rep Scope
              <select
                value={weeklyScope}
                onChange={(e) => setWeeklyScope(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              >
                <option value="ALL">All Sales Reps</option>
                {salesReps.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-gray-600">
              Check Date
              <input
                value={weeklyCheckDateText}
                disabled
                className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-700"
              />
            </label>

            <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <div>
                Commission Period: {weeklyFromText} - {weeklyToText}
              </div>
              <div>Check Date: {weeklyCheckDateText}</div>
              <div>
                Sales Rep Scope:{" "}
                {weeklyScope === "ALL"
                  ? "All Sales Reps"
                  : salesReps.find((r) => r.id === weeklyScope)?.displayName ||
                    weeklyScope}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowStartWeeklyModal(false)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startWeeklyCommission}
                className="rounded bg-blue-600 px-3 py-2 text-sm text-white"
              >
                Create Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddInvoiceModal && (
        <div className="fixed inset-0 z-[131] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Add Invoice
                </h2>
                <p className="text-sm text-gray-500">
                  Create a master open invoice. Weekly period is optional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddInvoiceModal(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-xs text-gray-600">
                Salesperson
                <select
                  value={addInvoiceForm.salesRepId}
                  onChange={(e) =>
                    setAddInvoiceForm((p) => ({
                      ...p,
                      salesRepId: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                >
                  <option value="">Unassigned</option>
                  {salesReps.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-gray-600">
                Invoice Date *
                <input
                  data-add-field="invoiceDate"
                  type="date"
                  value={addInvoiceForm.invoiceDate}
                  onChange={(e) =>
                    setAddInvoiceForm((p) => ({
                      ...p,
                      invoiceDate: e.target.value,
                    }))
                  }
                  className={`mt-1 w-full rounded border px-3 py-2 ${addInvoiceErrors.invoiceDate ? "border-red-400" : "border-gray-300"}`}
                />
                {addInvoiceErrors.invoiceDate && (
                  <div className="mt-1 text-xs text-red-600">
                    {addInvoiceErrors.invoiceDate}
                  </div>
                )}
              </label>

              <label className="text-xs text-gray-600">
                Invoice Number *
                <input
                  data-add-field="invoiceNumber"
                  value={addInvoiceForm.invoiceNumber}
                  onChange={(e) =>
                    setAddInvoiceForm((p) => ({
                      ...p,
                      invoiceNumber: e.target.value,
                    }))
                  }
                  className={`mt-1 w-full rounded border px-3 py-2 ${addInvoiceErrors.invoiceNumber ? "border-red-400" : "border-gray-300"}`}
                />
                {addInvoiceErrors.invoiceNumber && (
                  <div className="mt-1 text-xs text-red-600">
                    {addInvoiceErrors.invoiceNumber}
                  </div>
                )}
              </label>

              <label className="text-xs text-gray-600">
                Customer Name *
                <input
                  data-add-field="customerName"
                  value={addInvoiceForm.customerName}
                  onChange={(e) =>
                    setAddInvoiceForm((p) => ({
                      ...p,
                      customerName: e.target.value,
                    }))
                  }
                  className={`mt-1 w-full rounded border px-3 py-2 ${addInvoiceErrors.customerName ? "border-red-400" : "border-gray-300"}`}
                />
                {addInvoiceErrors.customerName && (
                  <div className="mt-1 text-xs text-red-600">
                    {addInvoiceErrors.customerName}
                  </div>
                )}
              </label>

              <label className="text-xs text-gray-600">
                Commission Rate
                <input
                  value={addInvoiceForm.commissionRate}
                  onChange={(e) =>
                    setAddInvoiceForm((p) => ({
                      ...p,
                      commissionRate: cleanNumeric(e.target.value),
                    }))
                  }
                  placeholder="7.5"
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>

              <label className="text-xs text-gray-600">
                Invoice Amount *
                <input
                  data-add-field="invoiceAmount"
                  value={addInvoiceForm.invoiceAmount}
                  onChange={(e) =>
                    setAddInvoiceForm((p) => ({
                      ...p,
                      invoiceAmount: cleanNumeric(e.target.value),
                    }))
                  }
                  className={`mt-1 w-full rounded border px-3 py-2 ${addInvoiceErrors.invoiceAmount ? "border-red-400" : "border-gray-300"}`}
                />
                {addInvoiceErrors.invoiceAmount && (
                  <div className="mt-1 text-xs text-red-600">
                    {addInvoiceErrors.invoiceAmount}
                  </div>
                )}
              </label>

              <label className="text-xs text-gray-600 md:col-span-2">
                Optional Notes
                <textarea
                  value={addInvoiceForm.notes}
                  onChange={(e) =>
                    setAddInvoiceForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  rows={3}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddInvoiceModal(false)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAddInvoice}
                disabled={addInvoiceBusy}
                className="inline-flex items-center gap-2 rounded bg-teal-600 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                {addInvoiceBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {noteRow && (
        <div className="fixed inset-0 z-[132] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Add Hold/Note
                </h2>
                <p className="text-xs text-gray-500">
                  {noteRow.customerName || "Invoice"}
                </p>
              </div>
              <button type="button" onClick={() => setNoteRow(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                ...new Set([
                  ...predefinedHolds,
                  ...noteOptions.map((x) => x.label),
                ]),
              ].map((label) => {
                const selected = noteReasons.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      setNoteReasons((prev) =>
                        selected
                          ? prev.filter((item) => item !== label)
                          : [...prev, label],
                      )
                    }
                    className={`rounded-full border px-2 py-1 text-xs ${selected ? "border-yellow-300 bg-yellow-100 text-yellow-800" : "border-gray-300 bg-white text-gray-700"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <label className="block text-xs text-gray-600">
              Free Text Note
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
                placeholder="Optional free text"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNoteRow(null)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNotesEditor}
                className="inline-flex items-center gap-2 rounded bg-teal-600 px-3 py-2 text-sm text-white"
              >
                <CheckCircle2 className="h-4 w-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-[133] flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Import CSV / Excel
                </h2>
                <p className="text-sm text-gray-500">
                  Preview before save with duplicates and validation flags.
                </p>
              </div>
              <button
                type="button"
                disabled={importBusy}
                onClick={() => {
                  setShowImportModal(false);
                  setImportPreview(null);
                  setImportPreviewRows([]);
                }}
                className="rounded border border-gray-300 px-2 py-1 disabled:opacity-60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <div className="rounded-lg border border-dashed border-gray-300 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadSample("xlsx")}
                    className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    <FileDown className="h-4 w-4" />
                    Download Sample File
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSample("csv")}
                    className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    Download CSV Sample
                  </button>
                </div>

                <input
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) previewImport(file);
                  }}
                />
                <div className="mt-2 text-xs text-gray-500">
                  Accepted file types: .csv, .xls, .xlsx
                </div>

                <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                  <div className="mb-1 font-semibold">Import Instructions</div>
                  <ul className="list-disc pl-4">
                    {buildImportInstructions().map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {importBusy && (
                <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {importMode === "commit"
                    ? "Committing import..."
                    : "Processing import preview..."}
                </div>
              )}

              {importPreview && (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
                    <div className="rounded border border-gray-200 p-2">
                      Rows found: {importPreview.summary.totalRows}
                    </div>
                    <div className="rounded border border-gray-200 p-2">
                      Missing invoice #:{" "}
                      {importPreview.summary.missingInvoiceNumber}
                    </div>
                    <div className="rounded border border-gray-200 p-2">
                      Missing amount: {importPreview.summary.missingAmount || 0}
                    </div>
                    <div className="rounded border border-gray-200 p-2">
                      Invalid commission rate:{" "}
                      {importPreview.summary.invalidCommissionRate}
                    </div>
                    <div className="rounded border border-gray-200 p-2">
                      Unmatched initials:{" "}
                      {importPreview.summary.unmatchedSalesRepInitials}
                    </div>
                    <div className="rounded border border-gray-200 p-2">
                      Duplicates: {importPreview.summary.duplicatesInSystem}
                    </div>
                    <div className="rounded border border-gray-200 p-2">
                      Create: {importPreview.summary.rowsToCreate}
                    </div>
                    <div className="rounded border border-gray-200 p-2">
                      Update: {importPreview.summary.rowsToUpdate}
                    </div>
                    <div className="rounded border border-gray-200 p-2">
                      Duplicate:{" "}
                      {importPreview.summary.rowsMarkedDuplicate || 0}
                    </div>
                    <div className="rounded border border-gray-200 p-2">
                      Conflict: {importPreview.summary.rowsMarkedConflict || 0}
                    </div>
                  </div>

                  <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                    <div className="mb-1 font-semibold">Detected Columns</div>
                    <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                      {(importPreview.detectedColumns || []).map((col: any) => (
                        <div key={col.field}>
                          <span className="font-medium">{col.label}</span>
                          <span>
                            {" "}
                            -&gt; {col.matchedHeader || "Not detected"}
                          </span>
                        </div>
                      ))}
                    </div>
                    {(importPreview.missingRequiredColumns || []).length >
                      0 && (
                      <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-amber-800">
                        {(importPreview.missingRequiredColumns || []).map(
                          (label: string) => (
                            <div key={label}>
                              Could not find {label} column. Found headers:{" "}
                              {(importPreview.foundHeaders || []).join(", ")}
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  <div className="max-h-64 overflow-auto rounded border border-gray-200">
                    <table className="w-full text-xs">
                      <thead className="border-b border-gray-200 bg-gray-50">
                        <tr>
                          <th className="px-2 py-1 text-left">Line</th>
                          <th className="px-2 py-1 text-left">Date</th>
                          <th className="px-2 py-1 text-left">Invoice #</th>
                          <th className="px-2 py-1 text-left">Customer</th>
                          <th className="px-2 py-1 text-left">Sales Rep</th>
                          <th className="px-2 py-1 text-left">Rate</th>
                          <th className="px-2 py-1 text-left">Amount</th>
                          <th className="px-2 py-1 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreviewRows
                          .slice(0, 250)
                          .map((row: any, idx: number) => (
                            <tr
                              key={`${row.line}-${idx}`}
                              className="border-b border-gray-100"
                            >
                              <td className="px-2 py-1">{row.line}</td>
                              <td className="px-2 py-1">
                                {row.invoiceDateDisplay || "-"}
                              </td>
                              <td className="px-2 py-1">
                                <span
                                  className={
                                    row.duplicateInvoiceInImport
                                      ? "font-semibold text-amber-700"
                                      : ""
                                  }
                                >
                                  {row.invoiceNumber || "-"}
                                </span>
                              </td>
                              <td className="px-2 py-1">
                                {row.customerName || "-"}
                              </td>
                              <td className="px-2 py-1">
                                {row.mappedSalesRepName ||
                                  row.salesRepInitials ||
                                  "-"}
                              </td>
                              <td className="px-2 py-1">
                                {percent(row.commissionRate)}
                              </td>
                              <td className="px-2 py-1">
                                {row.invoiceAmount === null ||
                                row.invoiceAmount === undefined
                                  ? "-"
                                  : money(row.invoiceAmount)}
                              </td>
                              <td className="px-2 py-1">
                                <span
                                  className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                    row.actionType === "CREATE"
                                      ? "bg-green-100 text-green-700"
                                      : row.actionType === "UPDATE"
                                        ? "bg-blue-100 text-blue-700"
                                        : row.actionType === "DUPLICATE"
                                          ? "bg-yellow-100 text-yellow-800"
                                          : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {row.actionType ||
                                    (row.existsInSystem ? "UPDATE" : "CREATE")}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportPreview(null);
                  setImportPreviewRows([]);
                }}
                disabled={importBusy}
                className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-60"
              >
                Close
              </button>
              <button
                type="button"
                onClick={commitImport}
                disabled={
                  importBusy || !importPreview || importPreviewRows.length === 0
                }
                className="inline-flex items-center gap-2 rounded bg-teal-600 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirm Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

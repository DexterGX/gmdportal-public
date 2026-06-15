import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSalesCommissionAccess } from "@/lib/salesCommissionAuth";

type CanonicalFieldKey =
  | "salesRep"
  | "invoiceDate"
  | "invoiceNumber"
  | "customerName"
  | "commissionRate"
  | "invoiceAmount"
  | "quickbooksTxnId"
  | "firstPayment"
  | "thirdParty"
  | "refund"
  | "secondPayment"
  | "notes";

const canonicalLabels: Record<CanonicalFieldKey, string> = {
  salesRep: "Sales Rep",
  invoiceDate: "Invoice Date",
  invoiceNumber: "Invoice Number",
  customerName: "Customer Name",
  commissionRate: "Commission Rate",
  invoiceAmount: "Invoice Amount",
  quickbooksTxnId: "QuickBooks Transaction ID",
  firstPayment: "First Payment",
  thirdParty: "Third Party",
  refund: "Refund",
  secondPayment: "Second Payment",
  notes: "Notes",
};

const headerAliases: Record<CanonicalFieldKey, string[]> = {
  salesRep: ["sales rep", "salesrep", "salesperson", "sales person", "rep"],
  invoiceDate: ["invoice date", "invoicedate", "date", "inv date", "invdate"],
  invoiceNumber: [
    "invoice number",
    "invoicenumber",
    "invoice #",
    "invoice#",
    "invoice no",
    "invoiceno",
    "invoice num",
    "invoicenum",
    "inv #",
    "inv#",
    "inv no",
    "invno",
    "inv num",
    "invnum",
    "num",
    "no",
  ],
  customerName: [
    "customer name",
    "customername",
    "customer",
    "client name",
    "clientname",
    "client",
  ],
  commissionRate: [
    "commission rate",
    "commissionrate",
    "% commission",
    "%commission",
    "commission %",
    "commission%",
    "internal use",
    "internaluse",
    "rate",
    "% cr",
    "cr",
  ],
  invoiceAmount: [
    "invoice amount",
    "invoiceamount",
    "inv amount",
    "invamount",
    "amount",
    "total",
    "invoice total",
    "invoicetotal",
    "inv total",
    "invtotal",
  ],
  quickbooksTxnId: [
    "quickbooks transaction id",
    "quickbookstransactionid",
    "quickbooks txn id",
    "quickbookstxnid",
    "qb transaction id",
    "qbtransactionid",
    "qb txn id",
    "qbtxnid",
    "txn id",
    "txnid",
  ],
  firstPayment: [
    "first payment",
    "firstpayment",
    "1st payment",
    "1stpayment",
    "1st pmt",
    "1stpmt",
    "first pmt",
    "firstpmt",
  ],
  thirdParty: [
    "third party",
    "thirdparty",
    "3rd party",
    "3rdparty",
    "3rd par",
    "third par",
  ],
  refund: ["refund", "refunds"],
  secondPayment: [
    "second payment",
    "secondpayment",
    "2nd payment",
    "2ndpayment",
    "2nd pmt",
    "2ndpmt",
    "second pmt",
    "secondpmt",
  ],
  notes: ["notes", "note", "hold", "holds", "reason", "reasons"],
};

const requiredFields: CanonicalFieldKey[] = [
  "invoiceNumber",
  "customerName",
  "commissionRate",
  "invoiceAmount",
  "invoiceDate",
  "salesRep",
];

function normalizeHeader(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[#]/g, " number ")
    .replace(/[%]/g, " percent ")
    .replace(/[^a-z0-9]/g, "")
    .replace(/number/g, "num")
    .replace(/\s+/g, "");
}

function normalizeCellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  return String(value).trim();
}

function parseDecimal(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const text = String(value).trim();
  if (!text) return null;

  const cleaned = text
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/\((.+)\)/, "-$1")
    .replace(/[^0-9.-]/g, "");

  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInvoiceNumber(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) return String(value);
    const rounded = Math.round(value);
    if (Math.abs(value - rounded) < 1e-9) return String(rounded);
    return String(value);
  }

  const text = String(value).trim();
  if (!text) return "";

  if (/^-?\d+\.0+$/.test(text)) {
    return text.split(".")[0];
  }

  return text;
}

function parseCommissionRate(value: unknown): number | null {
  const parsed = parseDecimal(value);
  if (parsed === null) return null;

  if (parsed > 0 && parsed < 1) {
    return Number((parsed * 100).toFixed(4));
  }

  return parsed;
}

function parseMoney(value: unknown): number | null {
  return parseDecimal(value);
}

function parseDateIso(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel date serial number conversion using 1899-12-30 epoch.
    const excelEpochUtc = Date.UTC(1899, 11, 30);
    const millis = excelEpochUtc + Math.round(value * 86400 * 1000);
    const d = new Date(millis);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }

  const text = String(value).trim();
  if (!text) return "";

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  const mdy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const mm = Number(mdy[1]);
    const dd = Number(mdy[2]);
    const yyyy = Number(mdy[3]);
    const d = new Date(Date.UTC(yyyy, mm - 1, dd));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  return "";
}

function isoToDisplay(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function buildHeaderMatcher(rows: Record<string, unknown>[]) {
  const headerSet = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((k) => {
      if (String(k || "").trim()) headerSet.add(k);
    });
  });

  const foundHeaders = Array.from(headerSet);
  const normalizedHeaderMap = new Map<string, string>();
  foundHeaders.forEach((header) => {
    const normalized = normalizeHeader(header);
    if (normalized && !normalizedHeaderMap.has(normalized)) {
      normalizedHeaderMap.set(normalized, header);
    }
  });

  const aliasToKey = new Map<string, CanonicalFieldKey>();
  (Object.keys(headerAliases) as CanonicalFieldKey[]).forEach((key) => {
    headerAliases[key].forEach((alias) => {
      aliasToKey.set(normalizeHeader(alias), key);
    });
  });

  const matchedColumnByKey: Partial<Record<CanonicalFieldKey, string>> = {};

  normalizedHeaderMap.forEach((originalHeader, normalizedHeader) => {
    const key = aliasToKey.get(normalizedHeader);
    if (key && !matchedColumnByKey[key]) {
      matchedColumnByKey[key] = originalHeader;
    }
  });

  return {
    foundHeaders,
    matchedColumnByKey,
  };
}

function readByField(
  row: Record<string, unknown>,
  key: CanonicalFieldKey,
  matchedColumnByKey: Partial<Record<CanonicalFieldKey, string>>,
): unknown {
  const matchedHeader = matchedColumnByKey[key];
  if (matchedHeader) return row[matchedHeader];

  // Last-chance fallback: scan row keys by normalized aliases.
  const aliases = new Set(
    headerAliases[key].map((alias) => normalizeHeader(alias)),
  );
  for (const header of Object.keys(row)) {
    if (aliases.has(normalizeHeader(header))) return row[header];
  }
  return undefined;
}

function detectDuplicateRows(rows: NormalizedRow[]) {
  const invoiceCounts = new Map<string, number>();
  const txnCounts = new Map<string, number>();

  rows.forEach((row) => {
    if (row.invoiceNumber) {
      invoiceCounts.set(
        row.invoiceNumber,
        (invoiceCounts.get(row.invoiceNumber) || 0) + 1,
      );
    }
    if (row.quickbooksTxnId) {
      txnCounts.set(
        row.quickbooksTxnId,
        (txnCounts.get(row.quickbooksTxnId) || 0) + 1,
      );
    }
  });

  const duplicateInvoiceKeys = new Set(
    Array.from(invoiceCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([invoice]) => invoice),
  );

  const duplicateTxnKeys = new Set(
    Array.from(txnCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([txn]) => txn),
  );

  return { duplicateInvoiceKeys, duplicateTxnKeys };
}

type NormalizedRow = {
  invoiceNumber: string;
  salesRepInitials: string;
  customerName: string;
  commissionRate: number | null;
  invoiceAmount: number | null;
  invoiceDate: string;
  invoiceDateDisplay: string;
  paidDate: string;
  quickbooksTxnId: string;
  firstPayment: number | null;
  thirdPartyAdjustment: number | null;
  refundAdjustment: number | null;
  secondPayment: number | null;
  notes: string;
  sourceRow: Record<string, unknown>;
};

function normalizeRow(
  raw: unknown,
  matchedColumnByKey: Partial<Record<CanonicalFieldKey, string>>,
): NormalizedRow {
  const row = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;

  const invoiceDate = parseDateIso(
    readByField(row, "invoiceDate", matchedColumnByKey),
  );

  return {
    invoiceNumber: parseInvoiceNumber(
      readByField(row, "invoiceNumber", matchedColumnByKey),
    ),
    salesRepInitials: normalizeCellText(
      readByField(row, "salesRep", matchedColumnByKey),
    ),
    customerName: normalizeCellText(
      readByField(row, "customerName", matchedColumnByKey),
    ),
    commissionRate: parseCommissionRate(
      readByField(row, "commissionRate", matchedColumnByKey),
    ),
    invoiceAmount: parseMoney(
      readByField(row, "invoiceAmount", matchedColumnByKey),
    ),
    invoiceDate,
    invoiceDateDisplay: isoToDisplay(invoiceDate),
    paidDate: "",
    quickbooksTxnId: normalizeCellText(
      readByField(row, "quickbooksTxnId", matchedColumnByKey),
    ),
    firstPayment: parseMoney(
      readByField(row, "firstPayment", matchedColumnByKey),
    ),
    thirdPartyAdjustment: parseMoney(
      readByField(row, "thirdParty", matchedColumnByKey),
    ),
    refundAdjustment: parseMoney(
      readByField(row, "refund", matchedColumnByKey),
    ),
    secondPayment: parseMoney(
      readByField(row, "secondPayment", matchedColumnByKey),
    ),
    notes: normalizeCellText(readByField(row, "notes", matchedColumnByKey)),
    sourceRow: row,
  };
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireSalesCommissionAccess();
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    if (!["admin", "finance"].includes(access.appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const periodId = String(body?.periodId || "").trim();
    const rawRows = Array.isArray(body?.rows) ? body.rows : [];

    if (!periodId) {
      return NextResponse.json(
        { error: "periodId is required" },
        { status: 400 },
      );
    }

    const objectRows = rawRows
      .map((raw: unknown) =>
        raw && typeof raw === "object"
          ? (raw as Record<string, unknown>)
          : null,
      )
      .filter(
        (row: Record<string, unknown> | null): row is Record<string, unknown> =>
          Boolean(row),
      );

    const { foundHeaders, matchedColumnByKey } = buildHeaderMatcher(objectRows);

    const normalizedRows: NormalizedRow[] = objectRows.map(
      (raw: Record<string, unknown>) => normalizeRow(raw, matchedColumnByKey),
    );

    const reps = await prisma.salesCommissionSalesRep.findMany({
      where: { active: true },
      select: { id: true, displayName: true, quickbooksInitials: true },
    });

    const repMap = new Map(
      reps
        .filter((rep) => rep.quickbooksInitials)
        .map((rep) => [rep.quickbooksInitials.toLowerCase(), rep]),
    );

    const invoiceNumbers = Array.from(
      new Set(normalizedRows.map((row) => row.invoiceNumber).filter(Boolean)),
    );

    const quickbooksTxnIds = Array.from(
      new Set(normalizedRows.map((row) => row.quickbooksTxnId).filter(Boolean)),
    );

    const existingInvoices = await prisma.salesCommissionInvoice.findMany({
      where: {
        periodId,
        OR: [
          ...(invoiceNumbers.length
            ? [{ invoiceNumber: { in: invoiceNumbers } }]
            : []),
          ...(quickbooksTxnIds.length
            ? [{ quickbooksTxnId: { in: quickbooksTxnIds } }]
            : []),
        ],
      },
      select: {
        id: true,
        invoiceNumber: true,
        quickbooksTxnId: true,
        manualOverrideFields: true,
      },
    });

    const existingByInvoiceNumber = new Map(
      existingInvoices
        .filter((item) => item.invoiceNumber)
        .map((item) => [String(item.invoiceNumber), item]),
    );

    const existingByTxnId = new Map(
      existingInvoices
        .filter((item) => item.quickbooksTxnId)
        .map((item) => [String(item.quickbooksTxnId), item]),
    );

    const { duplicateInvoiceKeys, duplicateTxnKeys } =
      detectDuplicateRows(normalizedRows);

    let missingInvoiceNumber = 0;
    let missingAmount = 0;
    let invalidCommissionRate = 0;
    let unmatchedSalesRepInitials = 0;
    let duplicatesInSystem = 0;
    let rowsToCreate = 0;
    let rowsToUpdate = 0;
    let rowsMarkedDuplicate = 0;
    let rowsMarkedConflict = 0;
    let manualConflictRows = 0;
    let quickbooksTxnIdFound = 0;
    let quickbooksTxnIdMissing = 0;
    let quickbooksTxnIdConflicts = 0;

    const previewRows = normalizedRows.map((row, idx) => {
      const hasInvoiceNumber = Boolean(row.invoiceNumber);
      if (!hasInvoiceNumber) missingInvoiceNumber += 1;

      const hasAmount = row.invoiceAmount !== null;
      if (!hasAmount) missingAmount += 1;

      const hasValidRate = row.commissionRate !== null;
      if (!hasValidRate) invalidCommissionRate += 1;

      const rep = row.salesRepInitials
        ? repMap.get(row.salesRepInitials.toLowerCase())
        : null;
      if (!rep) unmatchedSalesRepInitials += 1;

      const byTxn = row.quickbooksTxnId
        ? existingByTxnId.get(row.quickbooksTxnId)
        : null;
      const byInvoice = row.invoiceNumber
        ? existingByInvoiceNumber.get(row.invoiceNumber)
        : null;

      const hasIdentityConflict = Boolean(
        byTxn && byInvoice && byTxn.id !== byInvoice.id,
      );
      const existing = byTxn || byInvoice;
      const existingMatchType = byTxn
        ? "quickbooksTxnId"
        : byInvoice
          ? "invoiceNumber"
          : null;

      const hasQbTxn = Boolean(row.quickbooksTxnId);
      if (hasQbTxn) quickbooksTxnIdFound += 1;
      else quickbooksTxnIdMissing += 1;

      const hasQuickbooksTxnConflict =
        Boolean(existing?.quickbooksTxnId) &&
        hasQbTxn &&
        String(existing?.quickbooksTxnId).trim() !== row.quickbooksTxnId;
      if (hasQuickbooksTxnConflict) quickbooksTxnIdConflicts += 1;

      const duplicateInvoiceInImport = Boolean(
        row.invoiceNumber && duplicateInvoiceKeys.has(row.invoiceNumber),
      );
      const duplicateTxnInImport = Boolean(
        row.quickbooksTxnId && duplicateTxnKeys.has(row.quickbooksTxnId),
      );

      let actionType: "CREATE" | "UPDATE" | "DUPLICATE" | "CONFLICT" = "CREATE";
      if (duplicateTxnInImport) {
        actionType = "DUPLICATE";
      } else if (hasIdentityConflict) {
        actionType = "CONFLICT";
      } else if (existing) {
        if (
          (existing.manualOverrideFields || []).length > 0 ||
          hasQuickbooksTxnConflict
        ) {
          actionType = "CONFLICT";
        } else {
          actionType = "UPDATE";
        }
      }

      if (existing) duplicatesInSystem += 1;
      if (actionType === "CREATE") rowsToCreate += 1;
      if (actionType === "UPDATE") rowsToUpdate += 1;
      if (actionType === "DUPLICATE") rowsMarkedDuplicate += 1;
      if (actionType === "CONFLICT") rowsMarkedConflict += 1;
      if (existing && (existing.manualOverrideFields || []).length > 0)
        manualConflictRows += 1;

      return {
        line: idx + 1,
        ...row,
        mappedSalesRepId: rep?.id || null,
        mappedSalesRepName: rep?.displayName || row.salesRepInitials || null,
        unmatchedSalesRep: !rep,
        existsInSystem: Boolean(existing),
        existingInvoiceId: existing?.id || null,
        existingMatchType,
        hasManualConflict: Boolean(
          existing && (existing.manualOverrideFields || []).length > 0,
        ),
        hasQuickbooksTxnConflict,
        hasIdentityConflict,
        duplicateInImport: Boolean(
          duplicateInvoiceInImport || duplicateTxnInImport,
        ),
        duplicateInvoiceInImport,
        duplicateTxnInImport,
        existingQuickbooksTxnId: existing?.quickbooksTxnId || null,
        actionType,
      };
    });

    const detectedColumns = (
      Object.keys(canonicalLabels) as CanonicalFieldKey[]
    ).map((key) => ({
      field: key,
      label: canonicalLabels[key],
      matchedHeader: matchedColumnByKey[key] || null,
    }));

    const missingRequiredColumns = requiredFields
      .filter((key) => !matchedColumnByKey[key])
      .map((key) => canonicalLabels[key]);

    return NextResponse.json({
      summary: {
        totalRows: normalizedRows.length,
        missingInvoiceNumber,
        missingAmount,
        invalidCommissionRate,
        unmatchedSalesRepInitials,
        duplicatesInSystem,
        rowsToCreate,
        rowsToUpdate,
        rowsMarkedDuplicate,
        rowsMarkedConflict,
        manualConflictRows,
        quickbooksTxnIdFound,
        quickbooksTxnIdMissing,
        quickbooksTxnIdConflicts,
      },
      detectedColumns,
      foundHeaders,
      missingRequiredColumns,
      previewRows,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to preview import" },
      { status: 500 },
    );
  }
}

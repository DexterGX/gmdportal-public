// Shared types for Sales Commission V2

export type CMSWeekStatus = "DRAFT" | "REVIEW" | "APPROVED";

export type CMSInvoiceStatus =
  | "PENDING"
  | "FIRST_PAYMENT"
  | "FIRST_PAID"
  | "SECOND_PAYMENT"
  | "BOTH_PAYMENTS"
  | "HOLD"
  | "HOLD_SIGNATURE";

export interface CMSWeek {
  id: string;
  weekStart: string; // ISO date string
  weekEnd: string;
  checkDate: string;
  status: CMSWeekStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  invoices?: CMSInvoice[];
}

export interface CMSInvoice {
  id: string;
  weekId: string;
  salesRep: string;
  invoiceDate: string;
  invoiceNumber: string;
  customer: string;
  commissionRate: number; // percentage, e.g. 8
  amount: number;
  calculatedCommission: number; // amount * rate / 100
  firstPaymentAmount: number; // 60% of calculatedCommission
  secondPaymentAmount: number; // 40% adjusted
  payFirst: boolean;
  paySecond: boolean;
  firstPaid: boolean;
  firstPaidDate: string | null;
  secondPaid: boolean;
  secondPaidDate: string | null;
  thirdPartyAmount: number | null;
  refundAmount: number | null;
  notes: string | null;
  isNew: boolean;
  status: CMSInvoiceStatus;
  originalInvoiceId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CMSClosedInvoice {
  id: string;
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
  firstPaidDate: string | null;
  secondPaidDate: string | null;
  notes: string | null;
  weekStart: string;
  weekEnd: string;
  checkDate: string;
  originalInvoiceId: string | null;
  closedAt: string;
}

export interface CMSSettings {
  id: string;
  firstPaymentPercent: number;
  secondPaymentPercent: number;
  minWeeklyPay: number;
  colorPending: string;
  colorFirstPayment: string;
  colorFirstPaid: string;
  colorClosing: string;
  colorHold: string;
  colorHoldSignature: string;
  colorError: string;
  createdAt: string;
  updatedAt: string;
}

export function isBonusCustomerName(
  customer: string | null | undefined,
): boolean {
  return (customer ?? "").trim().toUpperCase() === "BONUS";
}

// Helpers
export function calcCommission(amount: number, rate: number): number {
  return parseFloat(((amount * rate) / 100).toFixed(2));
}

export function calcFirstPayment(
  commission: number,
  firstPercent: number,
): number {
  return parseFloat(((commission * firstPercent) / 100).toFixed(2));
}

export function calcAdjustedCommission(
  amount: number,
  rate: number,
  thirdParty: number,
  refund: number,
): number {
  const adjustedAmount = amount - thirdParty - refund;
  return calcCommission(adjustedAmount, rate);
}

export function calcSecondPayment(
  adjustedCommission: number,
  firstPaymentAmount: number,
): number {
  return parseFloat((adjustedCommission - firstPaymentAmount).toFixed(2));
}

// Reason tags that can be attached to an invoice's Notes field. Any reason
// in HOLD_REASONS marks the invoice as on hold; HOLD_SIGNATURE_REASONS is a
// stricter subset for a missing signature specifically. These drive both
// the row color and the status label everywhere in the app, so there is a
// single source of truth for "what does this invoice's status mean"
// regardless of which week it lives in.
export const NOTE_REASON_OPTIONS = [
  "No Deposit",
  "Not Signed",
  "Customer Hold",
  "Install Pending",
  "Waiting Final Payment",
  "Missing Info",
  "On Hold",
  "Material Delay",
  "Customer Requested Delay",
];

export const HOLD_SIGNATURE_REASONS = new Set(["Not Signed"]);
export const HOLD_REASONS = new Set(NOTE_REASON_OPTIONS);

export function parseNoteReasons(notes: string | null | undefined): string[] {
  if (!notes) return [];
  return notes
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function getHoldStatusFromNotes(
  notes: string | null | undefined,
): CMSInvoiceStatus | null {
  const reasons = parseNoteReasons(notes);
  if (reasons.some((reason) => HOLD_SIGNATURE_REASONS.has(reason)))
    return "HOLD_SIGNATURE";
  if (reasons.some((reason) => HOLD_REASONS.has(reason))) return "HOLD";
  return null;
}

export function getPaymentStatus(
  payFirst: boolean,
  paySecond: boolean,
  firstPaid: boolean,
  secondPaid: boolean,
): CMSInvoiceStatus {
  if (firstPaid && secondPaid) return "BOTH_PAYMENTS";
  if (payFirst && paySecond) return "BOTH_PAYMENTS";
  if (secondPaid) return "BOTH_PAYMENTS";
  if (paySecond) return "SECOND_PAYMENT";
  if (firstPaid) return "FIRST_PAID";
  if (payFirst) return "FIRST_PAYMENT";
  return "PENDING";
}

/**
 * Single source of truth for an invoice's status. A hold reason in Notes
 * (e.g. "No Deposit", "Not Signed") always wins over payment state, so the
 * row color and status label stay correct even after the invoice is carried
 * into a new week, re-imported, or only partially edited. Server routes and
 * the client both call this instead of keeping their own copy of the rule.
 */
export function deriveInvoiceStatus(invoice: {
  notes?: string | null;
  payFirst?: boolean | null;
  paySecond?: boolean | null;
  firstPaid?: boolean | null;
  secondPaid?: boolean | null;
}): CMSInvoiceStatus {
  const holdStatus = getHoldStatusFromNotes(invoice.notes);
  if (holdStatus) return holdStatus;
  return getPaymentStatus(
    Boolean(invoice.payFirst),
    Boolean(invoice.paySecond),
    Boolean(invoice.firstPaid),
    Boolean(invoice.secondPaid),
  );
}

export function getInvoiceRowBg(
  invoice: CMSInvoice,
  settings: CMSSettings,
  hasDuplicate: boolean,
): string {
  // Always re-derive from Notes + payment flags rather than trusting a
  // possibly-stale stored `status` column, so the row color self-heals.
  const effectiveStatus = deriveInvoiceStatus(invoice);
  // Hold states have priority over generic invalid highlighting.
  if (effectiveStatus === "HOLD_SIGNATURE") return settings.colorHoldSignature;
  if (effectiveStatus === "HOLD") return settings.colorHold;
  // Red: invalid data check
  if (isInvoiceInvalid(invoice)) return settings.colorError;
  if (effectiveStatus === "SECOND_PAYMENT" || effectiveStatus === "BOTH_PAYMENTS")
    return settings.colorClosing;
  if (effectiveStatus === "FIRST_PAYMENT") return settings.colorFirstPayment;
  if (effectiveStatus === "FIRST_PAID") return settings.colorFirstPaid;
  return settings.colorPending;
}

export function isInvoiceInvalid(invoice: CMSInvoice): boolean {
  if (isBonusCustomerName(invoice.customer)) return false;
  if (!invoice.invoiceNumber || invoice.invoiceNumber.trim() === "")
    return true;
  if (
    !invoice.invoiceDate ||
    Number.isNaN(new Date(invoice.invoiceDate).getTime())
  )
    return true;
  if (isNaN(invoice.amount) || invoice.amount <= 0) return true;
  if (isNaN(invoice.commissionRate) || invoice.commissionRate <= 0) return true;
  return false;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatCurrency(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(val);
}

export const DEFAULT_SETTINGS: CMSSettings = {
  id: "",
  firstPaymentPercent: 60,
  secondPaymentPercent: 40,
  minWeeklyPay: 560,
  colorPending: "#FFFFFF",
  colorFirstPayment: "#BFDBFE",
  colorFirstPaid: "#F0F9FF",
  colorClosing: "#BBF7D0",
  colorHold: "#FEF08A",
  colorHoldSignature: "#FBCFE8",
  colorError: "#FECACA",
  createdAt: "",
  updatedAt: "",
};

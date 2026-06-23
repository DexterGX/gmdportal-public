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

export function getInvoiceRowBg(
  invoice: CMSInvoice,
  settings: CMSSettings,
  hasDuplicate: boolean,
): string {
  // Hold states have priority over generic invalid highlighting.
  if (invoice.status === "HOLD_SIGNATURE") return settings.colorHoldSignature;
  if (invoice.status === "HOLD") return settings.colorHold;
  // Red: invalid data check
  if (isInvoiceInvalid(invoice)) return settings.colorError;
  if (invoice.status === "SECOND_PAYMENT" || invoice.status === "BOTH_PAYMENTS")
    return settings.colorClosing;
  if (invoice.status === "FIRST_PAYMENT") return settings.colorFirstPayment;
  if (invoice.status === "FIRST_PAID") return settings.colorFirstPaid;
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

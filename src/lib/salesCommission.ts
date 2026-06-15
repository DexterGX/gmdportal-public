import { Prisma } from "@prisma/client";

export const DEFAULT_FIRST_COMMISSION_PERCENT = 60;
export const DEFAULT_SECOND_COMMISSION_PERCENT = 40;

export type CommissionCalcInput = {
  invoiceAmount: number;
  commissionRatePercent: number;
  thirdPartyAdjustment?: number;
  refundAdjustment?: number;
  firstCommissionPercent?: number;
  secondCommissionPercent?: number;
};

export type CommissionCalcResult = {
  adjustedInvoiceAmount: number;
  totalCommission: number;
  firstCommission: number;
  secondCommission: number;
  adjustedSecondCommission: number;
};

export function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function toMoney(value: unknown): number {
  return Math.round(toNumber(value) * 100) / 100;
}

export function toDecimal(value: unknown): Prisma.Decimal {
  return new Prisma.Decimal(toMoney(value));
}

function parseDateInput(value: Date | string): Date {
  if (value instanceof Date) return new Date(value);
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]) - 1;
    const d = Number(match[3]);
    return new Date(y, m, d);
  }
  return new Date(raw);
}

export function resolvePayWeek(dateValue: Date | string) {
  const date = parseDateInput(dateValue);
  date.setHours(0, 0, 0, 0);

  // Commission weeks run Friday -> Thursday, and the selected date should
  // always fall inside the returned period.
  const day = date.getDay();
  const offsetToFriday = (day + 2) % 7;

  const start = new Date(date);
  start.setDate(start.getDate() - offsetToFriday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return {
    start,
    end,
    checkDate: resolveSecondMondayAfter(end),
  };
}

export function resolveSecondMondayAfter(periodEndDate: Date | string) {
  const end = new Date(periodEndDate);
  end.setHours(0, 0, 0, 0);

  const firstMonday = new Date(end);
  const daysUntilMonday = (8 - end.getDay()) % 7 || 7;
  firstMonday.setDate(end.getDate() + daysUntilMonday);

  const secondMonday = new Date(firstMonday);
  secondMonday.setDate(firstMonday.getDate() + 7);
  return secondMonday;
}

export function calcCommission(
  input: CommissionCalcInput,
): CommissionCalcResult {
  const invoiceAmount = toMoney(input.invoiceAmount);
  const commissionRate = toNumber(input.commissionRatePercent) / 100;
  const firstPct = toNumber(
    input.firstCommissionPercent,
    DEFAULT_FIRST_COMMISSION_PERCENT,
  );
  const secondPct = toNumber(
    input.secondCommissionPercent,
    DEFAULT_SECOND_COMMISSION_PERCENT,
  );

  const thirdPartyAdjustment = toMoney(input.thirdPartyAdjustment ?? 0);
  const refundAdjustment = toMoney(input.refundAdjustment ?? 0);

  const adjustedInvoiceAmount = Math.max(
    0,
    toMoney(invoiceAmount - thirdPartyAdjustment - refundAdjustment),
  );

  const totalCommission = toMoney(invoiceAmount * commissionRate);
  const adjustedTotalCommission = toMoney(
    adjustedInvoiceAmount * commissionRate,
  );

  const firstCommission = toMoney(totalCommission * (firstPct / 100));
  const secondCommission = toMoney(totalCommission * (secondPct / 100));
  const adjustedSecondCommission = Math.max(
    0,
    toMoney(adjustedTotalCommission - firstCommission),
  );

  return {
    adjustedInvoiceAmount,
    totalCommission,
    firstCommission,
    secondCommission,
    adjustedSecondCommission,
  };
}

export function monthKeyFromDate(dateValue: Date | string) {
  const d = new Date(dateValue);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function formatDateInput(dateValue?: Date | string | null) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

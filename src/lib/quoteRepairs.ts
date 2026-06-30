import { Prisma, QuoteRepairStatus } from "@prisma/client";

export const QUOTE_REPAIR_STATUS_LABELS: Record<QuoteRepairStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  CHANGES_REQUESTED: "Changes Requested",
  APPROVED: "Approved",
  VOIDED: "Voided",
  ARCHIVED: "Archived",
};

export function normalizeQuoteRepairDisplayStatus(
  status: QuoteRepairStatus,
): "DRAFT" | "APPROVED" {
  return status === "APPROVED" ? "APPROVED" : "DRAFT";
}

export function formatUsd(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

export function formatUsPhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return String(value ?? "").trim();
}

export const QUOTE_REPAIR_AREA_OPTIONS = [
  { value: "MASTER", label: "Master" },
  { value: "GUEST", label: "Guest" },
  { value: "KITCHEN", label: "Kitchen" },
  { value: "WALL_UNIT", label: "Wall Unit" },
  { value: "GARAGE", label: "Garage" },
  { value: "LAUNDRY", label: "Laundry" },
  { value: "OTHER", label: "Other" },
] as const;

export const QUOTE_REPAIR_SERVICE_DEFAULTS = [
  "Construction Services",
  "Electric Services",
  "Plumbing Services",
  "Drywall Services",
  "Tile Services",
  "Appliances",
  "LED Services",
  "Others",
];

const QUOTE_REPAIR_VIEW_ROLES = ["admin", "sales", "office", "finance"];

export function formatQuoteRepairNumber(date: Date, sequence: number) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const seq = String(sequence).padStart(3, "0");
  return `QR${yy}${mm}${seq}`;
}

export function normalizeQuoteRepairAreas(input: unknown): string[] {
  const areas = Array.isArray(input) ? input : [];
  const normalized = areas
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .map((value) => {
      const upper = value.toUpperCase();
      const match = QUOTE_REPAIR_AREA_OPTIONS.find(
        (option) =>
          option.value === upper || option.label.toUpperCase() === upper,
      );
      return match?.value ?? value;
    });

  return Array.from(new Set(normalized));
}

export function getQuoteRepairAreaLabel(value: string) {
  const option = QUOTE_REPAIR_AREA_OPTIONS.find((item) => item.value === value);
  return option?.label ?? value;
}

export function formatQuoteRepairAreas(areas: unknown): string {
  const normalized = normalizeQuoteRepairAreas(areas);
  if (normalized.length === 0) {
    return "Other";
  }

  return normalized.map(getQuoteRepairAreaLabel).join(", ");
}

export function toCurrencyDecimal(value: unknown) {
  const numeric =
    typeof value === "string" ? Number(value) : Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(numeric.toFixed(2));
}

export function sumQuoteRepairItemPrices(
  items: Array<{ price?: Prisma.Decimal | null }>,
) {
  return items.reduce((total, item) => {
    const price = item.price ?? new Prisma.Decimal(0);
    return total.add(price);
  }, new Prisma.Decimal(0));
}

export function canViewQuoteRepair(role: string) {
  return QUOTE_REPAIR_VIEW_ROLES.includes(role);
}

export function canEditQuoteRepair(role: string, isOwnerOrCreator: boolean) {
  if (role === "admin") return true;
  if (role === "sales") return isOwnerOrCreator;
  return false;
}

export function canApproveQuoteRepair(role: string) {
  return role === "admin";
}

export function canManageQuoteRepairSettings(role: string) {
  return role === "admin";
}

export function isQuoteRepairItemMeaningful(input: {
  serviceNameSnapshot?: string | null;
  description?: string | null;
  price?: unknown;
}) {
  const service = String(input.serviceNameSnapshot ?? "").trim();
  const description = String(input.description ?? "").trim();
  const hasPrice =
    input.price !== null &&
    input.price !== undefined &&
    String(input.price).trim() !== "";
  return Boolean(service || description || hasPrice);
}

export function normalizeQuoteRepairText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function sanitizeRole(value: unknown) {
  return typeof value === "string" ? value.toLowerCase().trim() : "";
}

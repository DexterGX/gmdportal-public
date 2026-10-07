import type { NormalizedImportSlab } from "@/lib/slabsImport";

export type Brand = { id: string; name: string };

/** Existing slab as serialized by slabsImportServer.serializeExistingSlab. */
export type ExistingSlab = {
  id: string;
  slabNumber: number | null;
  brand: string;
  series: string | null;
  code: string | null;
  color: string;
  finish: string;
  heightIn: number;
  widthIn: number;
  thickness: string;
  squareFeet: number;
  listedPrice: number;
  finalPrice: number;
  status: string;
};

export type PreviewDiff = {
  newSlabs: NormalizedImportSlab[];
  changedSlabs: { existing: ExistingSlab; incoming: NormalizedImportSlab; changes: string[] }[];
  discontinuedSlabs: ExistingSlab[];
};

export type PreviewSummary = {
  newCount: number;
  changedCount: number;
  discontinuedCount: number;
  unchangedCount: number;
  alreadyUnavailableCount: number;
  totalProcessed: number;
};

export function formatCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function prettyEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Slabs Import Utilities
 *
 * Handles parsing, normalization, and diff logic for importing price lists.
 */

import type {
  Slab,
  SlabBrandConfig,
  SlabThickness,
  SlabFinish,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { computeFinalPrice } from "./slabsPricing";

/**
 * Raw row from uploaded template
 */
export type ImportRow = {
  brand: string;
  series: string | null;
  code: string | null;
  color: string;
  finish: string;
  heightIn: number;
  widthIn: number;
  thickness: string;
  sfPrice: number | null;
  slabPrice: number | null;
  status: string;
};

/**
 * Normalized import slab with computed values
 */
export type NormalizedImportSlab = {
  key: string; // `${brand}|${color}|${finish}|${thickness}`
  brand: string;
  series: string | null;
  code: string | null;
  color: string;
  sourceFinish: string; // raw value from file for preview display
  finish: string; // normalized
  heightIn: number;
  widthIn: number;
  sourceThickness: string; // raw value from file for preview display
  thickness: string; // normalized
  squareFeet: number; // one decimal
  sfPrice: number | null;
  slabPrice: number | null;
  listedPrice: number; // providerPrice per slab
  finalPrice: number; // computed
  status: string;
};

/**
 * Diff result showing what changes will be applied
 */
export type ImportDiff = {
  newSlabs: NormalizedImportSlab[];
  changedSlabs: {
    existing: Slab;
    incoming: NormalizedImportSlab;
    changes: string[]; // list of field names that changed
  }[];
  discontinuedSlabs: Slab[];
};

/**
 * Normalize thickness string to canonical format
 */
export function normalizeThickness(input: string): string {
  const lower = input.toLowerCase().replace(/\s+/g, "");

  // Map various formats to canonical strings
  if (
    lower.includes("2cm") ||
    lower.includes("20mm") ||
    lower === "two_cm" ||
    lower === "twocm"
  ) {
    return "2cm";
  }
  if (
    lower.includes("3cm") ||
    lower.includes("30mm") ||
    lower === "three_cm" ||
    lower === "threecm"
  ) {
    return "3cm";
  }
  if (lower.includes("8mm") || lower === "eight_mm" || lower === "eightmm") {
    return "8mm";
  }
  if (lower.includes("12mm") || lower === "twelve_mm" || lower === "twelvemm") {
    return "12mm";
  }

  if (
    lower.includes("15mm") ||
    lower === "fifteen_mm" ||
    lower === "fifteenmm"
  ) {
    return "15mm";
  }

  // Unknown values are accepted by mapping to a safe canonical default.
  return "2cm";
}

/**
 * Normalize finish string to uppercase enum format
 */
export function normalizeFinish(input: string): string {
  const normalized = input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const knownFinishes = new Set<string>([
    "CONCRETE",
    "DUAL",
    "HONED",
    "LEATHER",
    "MATTE",
    "NATURAL",
    "OTHER",
    "POLISHED",
    "ROUGH",
    "STONE",
    "ULTRA_ROUGH",
    "SATIN",
    "SATIN_HONED",
    "PATINATO",
    "LEVIGATO_PEARL",
    "GLAM",
    "GINZA",
    "HOLOS",
    "TWILL",
    "JUTA",
    "DENIM",
    "DAMIER",
    "LAVA",
    "SILK",
    "LUXE",
    "BRUSHED",
    "TEXTURED",
    "SMOOTH_MATTE",
    "TEXTURED_MATTE",
    "VELVET",
    "TEXTURED_VELVET",
    "SATIN_RIDGE",
    "SUEDE",
    "DECOR_POLISHED",
    "NANOTECH_POLISHED",
    "NATURAL_TOUCH",
    "RIVERWASHED",
    "SLATE",
    "ULTRASOFT",
    "SOFT_TOUCH",
    "BOOKMATCH",
  ]);

  if (knownFinishes.has(normalized)) {
    return normalized;
  }

  if (normalized.includes("SOFT_TOUCH")) return "SOFT_TOUCH";
  if (normalized.includes("MATTE")) return "MATTE";
  if (normalized.includes("POLISHED")) return "POLISHED";
  if (normalized.includes("HONED")) return "HONED";
  if (normalized.includes("LEATHER")) return "LEATHER";
  if (normalized.includes("NATURAL")) return "NATURAL";

  return "OTHER";
}

/**
 * Convert thickness enum to normalized string
 */
export function thicknessEnumToString(thickness: SlabThickness): string {
  switch (thickness) {
    case "TWO_CM":
      return "2cm";
    case "THREE_CM":
      return "3cm";
    case "EIGHT_MM":
      return "8mm";
    case "TWELVE_MM":
      return "12mm";
    case "FIFTEEN_MM":
      return "15mm";
    default:
      return "2cm";
  }
}

/**
 * Generate unique key for a slab (brand + color + finish + thickness)
 */
export function generateSlabKey(
  brand: string,
  color: string,
  finish: string,
  thickness: string
): string {
  const normalizedFinish = normalizeFinish(finish);
  const normalizedThickness = normalizeThickness(thickness);
  return `${brand.toLowerCase()}|${color
    .trim()
    .toLowerCase()}|${normalizedFinish.toLowerCase()}|${normalizedThickness.toLowerCase()}`;
}

/**
 * Compute square feet with one decimal place
 */
export function computeSquareFeet(heightIn: number, widthIn: number): number {
  const exactSF = (heightIn * widthIn) / 144;
  return Math.round(exactSF * 10) / 10;
}

/**
 * Normalize a single import row
 */
export function normalizeImportRow(
  row: ImportRow,
  brandConfig: SlabBrandConfig,
  brandName: string
): NormalizedImportSlab {
  const normalizedFinish = normalizeFinish(row.finish);
  const normalizedThickness = normalizeThickness(row.thickness);
  const key = generateSlabKey(brandName, row.color, row.finish, row.thickness);
  const squareFeet = computeSquareFeet(row.heightIn, row.widthIn);

  // Determine listed price: use slabPrice if present, otherwise compute from sfPrice
  let listedPrice: number;
  if (row.slabPrice != null && row.slabPrice > 0) {
    listedPrice = row.slabPrice;
  } else if (row.sfPrice != null && row.sfPrice > 0) {
    listedPrice = squareFeet * row.sfPrice;
  } else {
    listedPrice = 0; // fallback if neither provided
  }

  const finalPrice = parseFloat(
    computeFinalPrice(new Decimal(listedPrice), brandConfig).toString()
  );

  return {
    key,
    brand: brandName,
    series: row.series,
    code: row.code,
    color: row.color.trim(),
    sourceFinish: row.finish.trim(),
    finish: normalizedFinish,
    heightIn: row.heightIn,
    widthIn: row.widthIn,
    sourceThickness: row.thickness.trim(),
    thickness: normalizedThickness,
    squareFeet,
    sfPrice: row.sfPrice,
    slabPrice: row.slabPrice,
    listedPrice,
    finalPrice,
    status: row.status.toUpperCase(),
  };
}

/**
 * Compare existing slab with incoming slab to detect changes
 */
export function detectChanges(
  existing: Slab,
  incoming: NormalizedImportSlab
): string[] {
  const changes: string[] = [];

  if (existing.series !== incoming.series) changes.push("series");
  if (existing.providerCode !== incoming.code) changes.push("code");

  // Compare decimal values
  const widthDiff = Math.abs(
    parseFloat(existing.widthIn.toString()) - incoming.widthIn
  );
  if (widthDiff > 0.01) changes.push("widthIn");

  const heightDiff = Math.abs(
    parseFloat(existing.heightIn.toString()) - incoming.heightIn
  );
  if (heightDiff > 0.01) changes.push("heightIn");

  // Compare normalized thickness
  const existingThickNorm = thicknessEnumToString(existing.thickness);
  if (existingThickNorm !== incoming.thickness) changes.push("thickness");

  const listedDiff = Math.abs(
    parseFloat(existing.providerPrice.toString()) - incoming.listedPrice
  );
  if (listedDiff > 0.01) changes.push("listedPrice");

  const finalDiff = Math.abs(
    parseFloat(existing.finalPrice.toString()) - incoming.finalPrice
  );
  if (finalDiff > 0.01) changes.push("finalPrice");

  if (existing.status !== incoming.status) changes.push("status");

  return changes;
}

/**
 * Build key for existing slab in database
 */
export function buildExistingKey(
  slab: Slab & { brand: { name: string } }
): string {
  const thicknessStr = thicknessEnumToString(slab.thickness);
  return generateSlabKey(
    slab.brand.name,
    slab.color,
    slab.finish,
    thicknessStr
  );
}

/**
 * Compute diff between existing slabs and import data
 */
export function computeImportDiff(
  importSlabs: NormalizedImportSlab[],
  existingSlabs: (Slab & { brand: { name: string } })[],
  selectedBrandName: string
): ImportDiff {
  // Build map of existing slabs by key
  const existingMap = new Map<string, Slab & { brand: { name: string } }>();
  const seenKeys = new Set<string>();

  for (const slab of existingSlabs) {
    const key = buildExistingKey(slab);
    existingMap.set(key, slab);
  }

  const newSlabs: NormalizedImportSlab[] = [];
  const changedSlabs: ImportDiff["changedSlabs"] = [];

  // Process each import row
  for (const incoming of importSlabs) {
    seenKeys.add(incoming.key);
    const existing = existingMap.get(incoming.key);

    if (!existing) {
      // NEW SLAB
      newSlabs.push(incoming);
    } else {
      // POSSIBLE UPDATE
      const changes = detectChanges(existing, incoming);
      if (changes.length > 0) {
        changedSlabs.push({ existing, incoming, changes });
      }
    }
  }

  // Find discontinued slabs (existing but not in import for selected brand only)
  const discontinuedSlabs: (Slab & { brand: { name: string } })[] = [];
  for (const slab of existingSlabs) {
    const key = buildExistingKey(slab);
    // Only mark as discontinued if it belongs to selected brand and wasn't seen
    if (!seenKeys.has(key) && slab.brand.name === selectedBrandName) {
      discontinuedSlabs.push(slab);
    }
  }

  return {
    newSlabs,
    changedSlabs,
    discontinuedSlabs,
  };
}

/**
 * Map thickness string to Prisma enum
 */
export function mapThicknessToEnum(thickness: string): string {
  const lower = thickness.toLowerCase().replace(/\s/g, "");
  switch (lower) {
    case "2cm":
      return "TWO_CM";
    case "3cm":
      return "THREE_CM";
    case "8mm":
      return "EIGHT_MM";
    case "12mm":
      return "TWELVE_MM";
    case "15mm":
      return "FIFTEEN_MM";
    case "20mm":
      return "TWO_CM";
    default:
      return "TWO_CM"; // default fallback
  }
}

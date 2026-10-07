/**
 * Slabs Import Utilities
 *
 * Handles parsing, normalization, and diff logic for importing price lists.
 */

import type { Slab, SlabBrandConfig, SlabThickness } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { computeFinalPrice } from "./slabsPricing";
import {
  normalizeFinishStrict,
  normalizeThicknessStrict,
  slabSizeKey,
  type SlabTemplateRow,
} from "./slabsTemplate";

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
  key: string; // `${brand}|${color}|${finish}|${thickness}|${size}|${code}` - see slabMatchKeys
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
 * Normalize thickness string to canonical format.
 * Unknown values fall back to "2cm" here for legacy callers - the import
 * review screen uses normalizeThicknessStrict directly so unknowns get
 * flagged instead of silently becoming 2cm.
 */
export function normalizeThickness(input: string): string {
  return normalizeThicknessStrict(input) || "2cm";
}

/**
 * Normalize finish string to uppercase enum format (unknown -> OTHER)
 */
export function normalizeFinish(input: string): string {
  return normalizeFinishStrict(input).finish;
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
    case "SIX_MM":
      return "6mm";
    case "EIGHT_MM":
      return "8mm";
    case "TEN_MM":
      return "10mm";
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
  const key = slabMatchKeys(
    generateSlabKey(brandName, row.color, row.finish, row.thickness),
    row.heightIn,
    row.widthIn,
    row.code,
  ).full;
  const squareFeet = computeSquareFeet(row.heightIn, row.widthIn);

  // Determine listed price: use slabPrice if present, otherwise compute from sfPrice
  let listedPrice: number;
  if (row.slabPrice != null && row.slabPrice > 0) {
    listedPrice = row.slabPrice;
  } else if (row.sfPrice != null && row.sfPrice > 0) {
    listedPrice = Math.round(squareFeet * row.sfPrice * 100) / 100;
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
 * The three identities a slab can be matched on, most to least specific:
 *  - full:  brand|color|finish|thickness|size|code
 *  - sized: brand|color|finish|thickness|size
 *  - base:  brand|color|finish|thickness
 * A brand can sell the same color/finish/thickness in several sizes (e.g.
 * jumbo full slab and jumbo half slab, each with its own code), so size and
 * code are part of what makes a slab unique.
 */
export function slabMatchKeys(
  baseKey: string,
  heightIn: number | null | undefined,
  widthIn: number | null | undefined,
  code: string | null | undefined,
): { base: string; sized: string; full: string } {
  const sized = `${baseKey}|${slabSizeKey(heightIn, widthIn)}`;
  return { base: baseKey, sized, full: `${sized}|${(code || "").trim().toLowerCase()}` };
}

/**
 * Build base key (brand|color|finish|thickness) for an existing slab
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

function existingMatchKeys(slab: Slab & { brand: { name: string } }) {
  return slabMatchKeys(
    buildExistingKey(slab),
    parseFloat(slab.heightIn.toString()),
    parseFloat(slab.widthIn.toString()),
    slab.providerCode,
  );
}

/**
 * Compute diff between existing slabs and import data.
 *
 * Matching runs in three passes so several sizes of one color can coexist
 * while real changes are still detected:
 *  1. exact match on color+finish+thickness+size+code;
 *  2. same color+finish+thickness+size (only the code changed) - when it's
 *     a one-to-one pairing;
 *  3. same color+finish+thickness (the size changed) - only when exactly one
 *     unmatched slab is left on each side, so a jumbo is never "updated"
 *     into a regular slab when both exist.
 * Anything still unmatched is NEW (incoming) or NOT IN NEW LIST (existing).
 */
export function computeImportDiff(
  importSlabs: NormalizedImportSlab[],
  existingSlabs: (Slab & { brand: { name: string } })[],
  selectedBrandName: string
): ImportDiff {
  type Existing = Slab & { brand: { name: string } };
  const existingKeys = existingSlabs.map((slab) => ({ slab, keys: existingMatchKeys(slab) }));
  const incomingKeys = importSlabs.map((incoming) => ({
    incoming,
    keys: slabMatchKeys(
      generateSlabKey(incoming.brand, incoming.color, incoming.finish, incoming.thickness),
      incoming.heightIn,
      incoming.widthIn,
      incoming.code,
    ),
  }));

  const matchedExisting = new Set<string>();
  const pairs = new Map<number, Existing>(); // incoming index -> existing slab

  for (const level of ["full", "sized", "base"] as const) {
    const existingGroups = new Map<string, Existing[]>();
    for (const { slab, keys } of existingKeys) {
      if (matchedExisting.has(slab.id)) continue;
      const list = existingGroups.get(keys[level]) || [];
      list.push(slab);
      existingGroups.set(keys[level], list);
    }
    const incomingGroups = new Map<string, number[]>();
    incomingKeys.forEach(({ keys }, index) => {
      if (pairs.has(index)) return;
      const list = incomingGroups.get(keys[level]) || [];
      list.push(index);
      incomingGroups.set(keys[level], list);
    });

    for (const [key, incomingIdx] of incomingGroups) {
      const candidates = existingGroups.get(key) || [];
      if (candidates.length === 0) continue;
      // Exact identity: pair in order. Looser levels: only an unambiguous 1:1.
      if (level !== "full" && !(incomingIdx.length === 1 && candidates.length === 1)) continue;
      const count = Math.min(incomingIdx.length, candidates.length);
      for (let i = 0; i < count; i++) {
        pairs.set(incomingIdx[i], candidates[i]);
        matchedExisting.add(candidates[i].id);
      }
    }
  }

  const newSlabs: NormalizedImportSlab[] = [];
  const changedSlabs: ImportDiff["changedSlabs"] = [];
  importSlabs.forEach((incoming, index) => {
    const existing = pairs.get(index);
    if (!existing) {
      newSlabs.push(incoming);
      return;
    }
    const changes = detectChanges(existing, incoming);
    if (changes.length > 0) changedSlabs.push({ existing, incoming, changes });
  });

  const discontinuedSlabs = existingSlabs.filter(
    (slab) => !matchedExisting.has(slab.id) && slab.brand.name === selectedBrandName,
  );

  return { newSlabs, changedSlabs, discontinuedSlabs };
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
    case "6mm":
      return "SIX_MM";
    case "8mm":
      return "EIGHT_MM";
    case "10mm":
      return "TEN_MM";
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

/**
 * Convert a reviewed SlabTemplateRow (from the Import page's edit grid) into
 * the ImportRow shape normalizeImportRow() expects. Callers must have already
 * rejected rows with blocking issues (see computeRowIssues).
 */
export function templateRowToImportRow(row: SlabTemplateRow, brandName: string): ImportRow {
  return {
    brand: brandName,
    series: row.series?.trim() || null,
    code: row.code?.trim() || null,
    color: row.color.trim(),
    finish: row.finish,
    heightIn: row.heightIn || 0,
    widthIn: row.widthIn || 0,
    thickness: row.thickness,
    sfPrice: row.sfPrice != null && row.sfPrice > 0 ? row.sfPrice : null,
    slabPrice: row.slabPrice != null && row.slabPrice > 0 ? row.slabPrice : null,
    status: row.status || "AVAILABLE",
  };
}

/**
 * Cabinet Catalog Import Utilities
 *
 * Deterministic parsing, normalization, and diff logic for importing
 * vendor cabinet price lists. Mirrors the shape of slabsImport.ts, but the
 * column layout varies wildly between vendors (see cabinetCatalogImportAi.ts
 * for how a "parse plan" describing that layout gets produced) so parsing
 * here works off a raw row/column grid instead of a fixed header row.
 *
 * IMPORTANT: this module never talks to the AI. It only *applies* a parse
 * plan someone (AI or a human editing it) already produced, so the actual
 * numbers reviewed and imported always come straight from the spreadsheet
 * cells, not from anything the model wrote.
 */

import * as XLSX from "xlsx";
import Papa from "papaparse";

export type CabinetSummaryBucket = "STANDARD" | "DOUBLE" | "CUSTOM" | "MISC";

export const CABINET_SUMMARY_BUCKETS: CabinetSummaryBucket[] = [
  "STANDARD",
  "DOUBLE",
  "CUSTOM",
  "MISC",
];

/** A single sheet's cells, row-major, 0-indexed. Blank cells are null. */
export type RawGrid = (string | number | null)[][];

export type RawSheet = {
  sheetName: string;
  grid: RawGrid;
};

/**
 * Read every sheet of an uploaded workbook (or the single "sheet" a CSV
 * represents) into raw grids. Used both to build the AI prompt sample and
 * to apply the resulting parse plan to the full file.
 */
export function readWorkbookGrids(buffer: ArrayBuffer, fileName: string): RawSheet[] {
  const uint8Array = new Uint8Array(buffer);
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".csv")) {
    const text = new TextDecoder().decode(uint8Array);
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
    return [{ sheetName: "Sheet1", grid: normalizeGrid(parsed.data as any[][]) }];
  }

  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    const workbook = XLSX.read(uint8Array, { type: "array" });
    return workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const grid = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1,
        defval: null,
        raw: true,
      });
      return { sheetName, grid: normalizeGrid(grid) };
    });
  }

  throw new Error("Unsupported file format. Use CSV, XLS, or XLSX.");
}

function normalizeGrid(rows: any[][]): RawGrid {
  const normalized = rows.map((row) =>
    (row || []).map((cell) => {
      if (cell === undefined || cell === null || cell === "") return null;
      if (typeof cell === "number") return cell;
      const str = String(cell).trim();
      return str === "" ? null : str;
    }),
  );
  // Rows can come in shorter than the sheet's real column count - a
  // trailing blank CSV line only has one (empty) field, and a ragged
  // Excel row simply has fewer populated cells than a wider row above
  // it. Left as-is, indexing past a short row's length returns
  // `undefined` rather than `null`, which crashes any parser downstream
  // that only guards against `null` (parsePriceCell, category/section
  // lookups, etc.) - pad every row out to the grid's widest row so a
  // "missing" cell is always a real `null`, never `undefined`.
  const width = normalized.reduce((max, row) => Math.max(max, row.length), 0);
  return normalized.map((row) =>
    row.length < width ? [...row, ...Array(width - row.length).fill(null)] : row,
  );
}

/** Compact text rendering of a bounded slice of a grid, for the AI prompt. */
export function gridToPromptText(grid: RawGrid, maxRows = 70): string {
  const rows = grid.slice(0, maxRows);
  return rows
    .map((row, i) => {
      const cells = row.map((c) => (c === null ? "" : String(c))).join(" | ");
      return `${i}: ${cells}`;
    })
    .join("\n");
}

import { computeCabinetNetCost } from "./cabinetCatalogPricing";

function parsePriceCell(value: string | number | null): number | null {
  if (value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

// Some vendors bundle multiple colors/codes that share one price into a
// single column header (e.g. "CS, US" or "SM/PE/CT/NT") - split those into
// separate tiers, each getting that column's price, so a user picks a real
// individual color rather than a comma-joined label. A column with no
// delimiter just yields itself.
function splitTierNames(raw: string): string[] {
  const parts = raw
    .split(/[,/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [raw.trim()];
}

/**
 * The structural mapping needed to walk a raw grid into rows of
 * (code, description, category, prices per tier). Produced by the AI for a
 * first pass, editable by an admin, then applied deterministically here to
 * every row of the actual file - the AI never sees or touches the full file.
 */
export type CabinetImportParsePlan = {
  sheetName: string;
  dataStartRow: number; // 0-indexed row where item rows begin
  codeCol: number;
  descriptionCol: number;
  priceColumns: { col: number; tierName: string }[];
  // Category comes from either an explicit column (Diego's master sheet has
  // a literal CAT column) or from section-header rows that interrupt the
  // data (Eucucina/Jarlin style) - never both.
  categoryMode: "column" | "sectionRow" | "none";
  categoryColumn: number | null; // set when categoryMode === "column"
  sectionDetectColumn: number | null; // set when categoryMode === "sectionRow"
  // Small set of substring hints (case-insensitive) used to guess the
  // Cabinets Summary bucket for a category string, e.g. { categoryContains:
  // "drawer", bucket: "DOUBLE" }. First match wins; falls back to defaultBucket.
  categoryBucketHints: { categoryContains: string; bucket: CabinetSummaryBucket }[];
  defaultBucket: CabinetSummaryBucket;
};

export type NormalizedImportItemPrice = {
  tierName: string;
  price: number;
};

export type NormalizedImportItem = {
  key: string; // `${vendorName}|${code}`.toLowerCase()
  code: string;
  description: string;
  category: string | null;
  summaryBucket: CabinetSummaryBucket;
  prices: NormalizedImportItemPrice[];
  sourceRow: number; // 0-indexed row in the grid, for admin traceability
};

export function generateItemKey(vendorName: string, code: string): string {
  return `${vendorName.trim().toLowerCase()}|${code.trim().toLowerCase()}`;
}

function resolveBucket(
  category: string | null,
  hints: CabinetImportParsePlan["categoryBucketHints"],
  defaultBucket: CabinetSummaryBucket,
): CabinetSummaryBucket {
  if (!category) return defaultBucket;
  const lower = category.toLowerCase();
  for (const hint of hints) {
    if (hint.categoryContains && lower.includes(hint.categoryContains.toLowerCase())) {
      return hint.bucket;
    }
  }
  return defaultBucket;
}

/**
 * Walk every row of the grid from dataStartRow onward, applying the parse
 * plan. This is the only place actual prices get read out of the file.
 */
export type CabinetImportPricing = {
  // "retail": raw cell prices are list/retail prices and need the vendor's
  // discount applied to get GMD's actual cost. "net": raw cell prices are
  // already GMD's cost - pass through unchanged (this is today's behavior,
  // and the default when `pricing` is omitted entirely).
  mode: "retail" | "net";
  discount: number; // fraction off retail, e.g. 0.30 = 30% off - ignored when mode is "net"
};

export function applyParsePlan(
  grid: RawGrid,
  plan: CabinetImportParsePlan,
  vendorName: string,
  pricing?: CabinetImportPricing,
): { items: NormalizedImportItem[]; warnings: string[] } {
  const items: NormalizedImportItem[] = [];
  const warnings: string[] = [];
  let currentCategory: string | null = null;

  for (let r = plan.dataStartRow; r < grid.length; r++) {
    const row = grid[r] || [];
    const codeCell = row[plan.codeCol];
    const descCell = row[plan.descriptionCol];
    const sectionText =
      plan.sectionDetectColumn !== null ? row[plan.sectionDetectColumn] : null;
    const rowHasAnyPrice = plan.priceColumns.some(
      (pc) => parsePriceCell(row[pc.col]) !== null,
    );

    // A section/category header row (e.g. "BASE DRAWERS CABINETS") often
    // lands its text in the SAME column as the code or description - a
    // merged cell flattens to its first column, which is frequently codeCol.
    // So this can't just check "codeCell/descCell are both empty": instead,
    // treat a row as a section header when it carries no prices at all AND
    // it doesn't look like a real item row (a real row almost always has
    // BOTH a code and a description together, even if it happens to lack a
    // price in every tier).
    const looksLikeItemRow = codeCell !== null && descCell !== null;
    const isSectionRow =
      plan.categoryMode === "sectionRow" &&
      sectionText !== null &&
      !rowHasAnyPrice &&
      !looksLikeItemRow;

    if (isSectionRow) {
      currentCategory = String(sectionText).trim();
      continue;
    }

    const code = codeCell === null ? "" : String(codeCell).trim();
    const description = descCell === null ? "" : String(descCell).trim();

    if (!code && !description) continue; // blank separator row
    if (!code) {
      warnings.push(`Row ${r}: skipped, no code found ("${description}")`);
      continue;
    }

    const category =
      plan.categoryMode === "column" && plan.categoryColumn !== null
        ? row[plan.categoryColumn] === null
          ? null
          : String(row[plan.categoryColumn]).trim()
        : plan.categoryMode === "sectionRow"
          ? currentCategory
          : null;

    const prices: NormalizedImportItemPrice[] = [];
    for (const pc of plan.priceColumns) {
      const rawPrice = parsePriceCell(row[pc.col]);
      if (rawPrice === null) continue;
      const price =
        pricing?.mode === "retail"
          ? computeCabinetNetCost(rawPrice, pricing.discount)
          : rawPrice;
      for (const tierName of splitTierNames(pc.tierName)) {
        prices.push({ tierName, price });
      }
    }

    if (prices.length === 0) {
      warnings.push(`Row ${r}: skipped "${code}", no prices found in any tier column`);
      continue;
    }

    items.push({
      key: generateItemKey(vendorName, code),
      code,
      description,
      category,
      summaryBucket: resolveBucket(category, plan.categoryBucketHints, plan.defaultBucket),
      prices,
      sourceRow: r,
    });
  }

  return { items, warnings };
}

// ---------------------------------------------------------------------------
// Diff against existing catalog

export type ExistingCatalogItem = {
  id: string;
  code: string;
  description: string;
  category: string | null;
  summaryBucket: CabinetSummaryBucket;
  isActive: boolean;
  prices: { tierId: string; price: string | number; tier: { id: string; name: string } }[];
};

export type CabinetImportDiff = {
  newItems: NormalizedImportItem[];
  changedItems: {
    existing: ExistingCatalogItem;
    incoming: NormalizedImportItem;
    changes: string[];
  }[];
  discontinuedItems: ExistingCatalogItem[];
};

function pricesEqual(
  incoming: NormalizedImportItemPrice[],
  existing: ExistingCatalogItem["prices"],
): boolean {
  const existingByName = new Map(
    existing.map((p) => [p.tier.name.toLowerCase(), Number(p.price)]),
  );
  if (existingByName.size !== incoming.length) return false;
  for (const p of incoming) {
    const existingPrice = existingByName.get(p.tierName.toLowerCase());
    if (existingPrice === undefined || Math.abs(existingPrice - p.price) > 0.005) {
      return false;
    }
  }
  return true;
}

export function detectItemChanges(
  existing: ExistingCatalogItem,
  incoming: NormalizedImportItem,
): string[] {
  const changes: string[] = [];
  if (existing.description !== incoming.description) changes.push("description");
  if ((existing.category || "") !== (incoming.category || "")) changes.push("category");
  if (existing.summaryBucket !== incoming.summaryBucket) changes.push("summaryBucket");
  if (!pricesEqual(incoming.prices, existing.prices)) changes.push("prices");
  return changes;
}

export function computeImportDiff(
  incomingItems: NormalizedImportItem[],
  existingItems: ExistingCatalogItem[],
  vendorName: string,
): CabinetImportDiff {
  const existingByKey = new Map(
    existingItems.map((item) => [generateItemKey(vendorName, item.code), item]),
  );
  const seenKeys = new Set<string>();

  const newItems: NormalizedImportItem[] = [];
  const changedItems: CabinetImportDiff["changedItems"] = [];

  for (const incoming of incomingItems) {
    seenKeys.add(incoming.key);
    const existing = existingByKey.get(incoming.key);
    if (!existing) {
      newItems.push(incoming);
      continue;
    }
    const changes = detectItemChanges(existing, incoming);
    if (changes.length > 0) {
      changedItems.push({ existing, incoming, changes });
    }
  }

  const discontinuedItems = existingItems.filter(
    (item) => item.isActive && !seenKeys.has(generateItemKey(vendorName, item.code)),
  );

  return { newItems, changedItems, discontinuedItems };
}

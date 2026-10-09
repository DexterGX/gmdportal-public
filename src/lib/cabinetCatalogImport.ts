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
  // Round 12 follow-up: some vendor sheets carry the cabinet's dimensions
  // (e.g. `9" X 34 1/2" X 24"`) in their own separate column rather than
  // folded into the description text. When set, that column's text gets
  // appended onto the description so it isn't lost. Left null when the
  // description already includes the size, or the sheet has no separate
  // size column at all - never guessed, always the AI/admin's call.
  sizeCol: number | null;
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
  // Round 11: same substring-hint mechanism as categoryBucketHints, but
  // mapping to a row of GMD's real Installers Price Table (see
  // cabinetCatalogImportAi.ts) instead of the 4-bucket enum. Despite the
  // field name, categoryContains is matched against BOTH the row's
  // category AND its own description text (see resolveInstallationItem) -
  // a vendor often groups genuinely different item types (e.g. real
  // panels and dummy doors) under one umbrella category, so category text
  // alone can't tell them apart; the individual item's description
  // usually can. When more than one hint matches a row, the LONGEST
  // matching substring wins (not declaration order) - a broad hint like
  // "filler" shouldn't be able to swallow a row that a more specific hint
  // like "fluted filler" was actually written for.
  //
  // Round 12 follow-up #2: a hint match, when present, ALWAYS wins over
  // a CabinetInstallationServiceItem.bucketDefault (see applyParsePlan) -
  // the item-level hint is more specific than the blanket bucket rule.
  // The bucket default only fills in when nothing here matches a given
  // row, and even then only if the row isn't flagged in
  // installationItemExclusions below. Unlike defaultBucket, there is
  // deliberately no fallback here - a row nothing matches is left
  // unassigned (installationItemId: null) for an admin to fix, rather
  // than guessed.
  //
  // Round 12 follow-up #3: each hint may carry an optional confidence -
  // "low" when the AI's match is plausible but not certain. Rather than
  // staying silent on a shaky guess (the row would just fall back to the
  // bucket default or unassigned, hiding the uncertainty), the AI is
  // encouraged to still write the hint and mark it "low" so the applied
  // item is visibly flagged for admin review instead of silently trusted.
  // Missing/omitted confidence means "high" (the AI is sure).
  installationItemHints: {
    categoryContains: string;
    installationItemKey: string;
    confidence?: "high" | "low";
  }[];
  // Round 12 follow-up #2: GMD's own catalogs bucket some small
  // decorative/accessory parts (corbels, rosettes, blocks, onlays, knee
  // drawers, wine racks, and similar) as STANDARD or DOUBLE purely for
  // the Cabinets Summary count, even though they are NOT genuine full
  // cabinets for installation-pricing purposes. Without this, such a row
  // would silently inherit the bucket's "Standard Cabinet"/"Double
  // Cabinet" default just because its bucket matches - wrong, and
  // exactly the class of bug Diego flagged ("these small things all
  // being considered cabinets"). A row whose category+description
  // matches one of these patterns is excluded from the automatic bucket
  // default; it falls through to installationItemHints only (and is left
  // unassigned if nothing there matches either, rather than guessed).
  installationItemExclusions: { textContains: string }[];
};

// A row of the Installers Price Table, as handed to the AI/resolver -
// "key" is whichever of code/id is stable enough to reference the row by
// (code when the admin has set one, otherwise the row's own id).
export type CabinetInstallationItemOption = {
  id: string;
  code: string | null;
  description: string;
  // Round 12 follow-up: set when this item is the deterministic default for
  // an entire CabinetSummaryBucket (see the schema comment on
  // CabinetInstallationServiceItem.bucketDefault) - null for ordinary
  // accessory-style items that still rely on installationItemHints.
  bucketDefault: CabinetSummaryBucket | null;
};

export function installationItemOptionKey(item: { id: string; code: string | null }): string {
  return item.code || item.id;
}

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
  // Round 11: which Installers Price Table row prices this item's
  // installation - AI/admin-assigned, null if unmatched (no forced default).
  installationItemId: string | null;
  // Round 12 follow-up #3: true when installationItemId came from an
  // installationItemHints entry the AI marked confidence "low" - a
  // plausible but not certain match, surfaced in the review UI as a
  // "double-check this" flag rather than trusted silently. Always false
  // when installationItemId is null (nothing assigned to doubt) or came
  // from the deterministic bucket default (never a guess).
  installationItemUncertain: boolean;
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

// Substring mechanism like resolveBucket, but with no fallback (a row
// nothing matches simply stays unassigned) and, as of round 12 follow-up
// #2, MOST-SPECIFIC-MATCH-WINS rather than first-match-wins: a broad hint
// (e.g. "filler" or "molding", written for one item type) would otherwise
// swallow every row sharing that generic word, even when a more specific
// hint (e.g. "fluted filler") exists for that row's actual item type -
// picking the longest matching substring favors whichever hint text most
// precisely describes this particular row. Matches each hint against the
// row's category AND its own description together (not category alone) -
// a vendor's category label often groups several genuinely different item
// types (e.g. "PANELS AND DOORS" covering both real panels and dummy
// doors), so only the individual row's own description can actually tell
// them apart.
function resolveInstallationItem(
  category: string | null,
  description: string,
  hints: CabinetImportParsePlan["installationItemHints"] | undefined,
  installationItemIdByKey: Map<string, string>,
): { id: string; uncertain: boolean } | null {
  if (!hints || hints.length === 0) return null;
  const text = `${category || ""} ${description}`.toLowerCase();
  if (!text.trim()) return null;
  let bestKey: string | null = null;
  let bestLength = -1;
  let bestUncertain = false;
  for (const hint of hints) {
    const needle = hint.categoryContains ? hint.categoryContains.toLowerCase() : "";
    if (needle && text.includes(needle) && needle.length > bestLength) {
      bestKey = hint.installationItemKey;
      bestLength = needle.length;
      bestUncertain = hint.confidence === "low";
    }
  }
  if (!bestKey) return null;
  const id = installationItemIdByKey.get(bestKey);
  return id ? { id, uncertain: bestUncertain } : null;
}

// Round 12 follow-up #2: does this row's category+description match one of
// installationItemExclusions? Same text-building as resolveInstallationItem,
// but a plain "does any pattern appear" check - no key to resolve, no
// specificity contest, since these patterns only ever suppress the bucket
// default rather than pick an item.
function matchesExclusionPattern(
  category: string | null,
  description: string,
  patterns: CabinetImportParsePlan["installationItemExclusions"] | undefined,
): boolean {
  if (!patterns || patterns.length === 0) return false;
  const text = `${category || ""} ${description}`.toLowerCase();
  if (!text.trim()) return false;
  return patterns.some(
    (p) => p.textContains && text.includes(p.textContains.toLowerCase()),
  );
}

/**
 * Walk every row of the grid from dataStartRow onward, applying the parse
 * plan. This is the only place actual prices get read out of the file.
 *
 * All "Row N" text in warnings below uses `r + 1`, not the raw 0-indexed
 * `r` - the grid is 0-indexed (grid[0] is the sheet's first row) but a
 * spreadsheet's own row numbers, what an admin actually sees and counts
 * from when they go check a flagged row, start at 1.
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
  installationItems?: CabinetInstallationItemOption[],
): { items: NormalizedImportItem[]; warnings: string[] } {
  const items: NormalizedImportItem[] = [];
  const warnings: string[] = [];
  // A code that shows up on several rows (e.g. a toe kick printed once per
  // section) is ONE catalog item - merge the rows instead of importing it twice.
  const itemIndexByKey = new Map<string, number>();
  let currentCategory: string | null = null;
  const installationItemIdByKey = new Map(
    (installationItems || []).map((it) => [installationItemOptionKey(it), it.id]),
  );
  // Round 12 follow-up: any bucket with a designated default item (see
  // CabinetInstallationServiceItem.bucketDefault) resolves deterministically
  // from that bucket alone when nothing more specific applies. As of round
  // 12 follow-up #2, this is a FALLBACK, not an override: a matching
  // installationItemHints entry always wins over it, and a row flagged by
  // installationItemExclusions never gets it at all (see the loop below).
  const installationItemIdByBucket = new Map(
    (installationItems || [])
      .filter((it) => it.bucketDefault)
      .map((it) => [it.bucketDefault as CabinetSummaryBucket, it.id]),
  );

  // Some vendor sheets reprint their column headers periodically (one per
  // printed "page" of the source spreadsheet, e.g. every ~48 rows) - a
  // row like "SKU# | DESCRIPTION | WS | CS | US | ..." that repeats the
  // exact header text used to build this plan. Such a row can carry no
  // price (every tier cell holds a tier-name label again, not a number)
  // and lack a populated description cell, which gives it the exact same
  // signature `isSectionRow` below looks for on a genuine category label
  // ("BASE DRAWERS CABINETS"). Left unchecked, applying it as a section
  // header overwrites currentCategory with garbage like "SKU#" for every
  // item row that follows until the next real header. Guard against that
  // two ways: (a) if the header row immediately above the data can be
  // identified, remember its code/description/section-detect column text
  // so an exact repeat of that label is recognized; (b) independent of
  // that, if the candidate row's price-tier columns hold non-numeric text
  // rather than being genuinely blank, that's itself a strong signal the
  // row is a reprinted header, not a one-off category label - real
  // category rows are just a text label with nothing in the price columns.
  const headerRowLabels = new Set<string>();
  if (plan.dataStartRow > 0) {
    const headerRow = grid[plan.dataStartRow - 1] || [];
    for (const col of [plan.codeCol, plan.descriptionCol, plan.sectionDetectColumn]) {
      if (col === null || col === undefined) continue;
      const cell = headerRow[col];
      if (cell !== null && cell !== undefined) {
        const label = String(cell).trim().toLowerCase();
        if (label) headerRowLabels.add(label);
      }
    }
  }

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
    const isSectionRowCandidate =
      plan.categoryMode === "sectionRow" &&
      sectionText !== null &&
      !rowHasAnyPrice &&
      !looksLikeItemRow;

    if (isSectionRowCandidate) {
      const sectionLabel = String(sectionText).trim();
      const repeatsColumnHeader = headerRowLabels.has(sectionLabel.toLowerCase());
      const priceColumnsHoldText = plan.priceColumns.some((pc) => {
        const cell = row[pc.col];
        return cell !== null && parsePriceCell(cell) === null;
      });
      if (repeatsColumnHeader || priceColumnsHoldText) {
        warnings.push(
          `Row ${r + 1}: skipped "${sectionLabel}", looks like a repeated header row rather than a category label - kept previous category`,
        );
        continue;
      }
      currentCategory = sectionLabel;
      continue;
    }

    const code = codeCell === null ? "" : String(codeCell).trim();
    const baseDescription = descCell === null ? "" : String(descCell).trim();
    const sizeCell = plan.sizeCol !== null && plan.sizeCol !== undefined ? row[plan.sizeCol] : null;
    const sizeText = sizeCell === null ? "" : String(sizeCell).trim();
    const description =
      sizeText && !baseDescription.toLowerCase().includes(sizeText.toLowerCase())
        ? `${baseDescription} - ${sizeText}`
        : baseDescription;

    if (!code && !description) continue; // blank separator row
    if (!code) {
      warnings.push(`Row ${r + 1}: skipped, no code found ("${description}")`);
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
      warnings.push(`Row ${r + 1}: skipped "${code}", no prices found in any tier column`);
      continue;
    }

    const summaryBucket = resolveBucket(category, plan.categoryBucketHints, plan.defaultBucket);
    // Round 12 follow-up #2: check the specific item-level hint FIRST - it
    // beats the bucket default whenever it matches. Only fall back to the
    // bucket default when no hint matched, and only if this row isn't
    // flagged as a non-cabinet accessory (installationItemExclusions) -
    // otherwise leave it unassigned rather than wrongly inheriting
    // "Standard Cabinet"/"Double Cabinet".
    const hintMatch = resolveInstallationItem(
      category,
      description,
      plan.installationItemHints,
      installationItemIdByKey,
    );
    const excludedFromBucketDefault = matchesExclusionPattern(
      category,
      description,
      plan.installationItemExclusions,
    );
    const installationItemId = hintMatch
      ? hintMatch.id
      : excludedFromBucketDefault
        ? null
        : installationItemIdByBucket.get(summaryBucket) || null;
    // Round 12 follow-up #3: only a hint's own "low" confidence can make a
    // row uncertain - the bucket default is deterministic (never a guess),
    // and an unassigned row has nothing to doubt (it gets the separate
    // "needs attention" treatment in the UI instead).
    const installationItemUncertain = Boolean(hintMatch && hintMatch.uncertain);

    const itemKey = generateItemKey(vendorName, code);
    const earlierIndex = itemIndexByKey.get(itemKey);
    if (earlierIndex !== undefined) {
      const earlier = items[earlierIndex];
      const have = new Set(earlier.prices.map((p) => p.tierName.toLowerCase()));
      let added = 0;
      for (const p of prices) {
        if (have.has(p.tierName.toLowerCase())) continue;
        earlier.prices.push(p);
        added += 1;
      }
      warnings.push(
        `Row ${r + 1}: "${code}" already appears on row ${earlier.sourceRow + 1} - merged into one item${
          added > 0 ? ` (added ${added} price${added === 1 ? "" : "s"})` : ""
        }. Check that they are the same product.`,
      );
      continue;
    }
    itemIndexByKey.set(itemKey, items.length);
    items.push({
      key: itemKey,
      code,
      description,
      category,
      summaryBucket,
      installationItemId,
      installationItemUncertain,
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
  installationItemId: string | null;
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
  if ((existing.installationItemId || null) !== (incoming.installationItemId || null)) {
    changes.push("installationItem");
  }
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

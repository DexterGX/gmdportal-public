/**
 * GMD slab price-list TEMPLATE format - shared by the server (import/export
 * routes, AI extraction) and the browser (Import page review grid, "Download
 * as template"). Deliberately has NO Prisma/Node imports so it can be bundled
 * client-side.
 *
 * Template columns (in order):
 *   Brand | Series | Code | Color | Finish | H | W | Thickness | SF_Price | Slab_Price | Status
 *
 * Every import path - a file already in this template, or a vendor PDF/Excel
 * read by the AI - ends up as SlabTemplateRow[] so the review/edit screen,
 * the preview diff and the apply step only ever deal with one shape.
 */

export const SLAB_TEMPLATE_HEADERS = [
  "Brand",
  "Series",
  "Code",
  "Color",
  "Finish",
  "H",
  "W",
  "Thickness",
  "SF_Price",
  "Slab_Price",
  "Status",
] as const;

/** Canonical thickness strings, thinnest first. Map 1:1 to the SlabThickness enum. */
export const SLAB_THICKNESS_OPTIONS = ["6mm", "8mm", "10mm", "12mm", "15mm", "2cm", "3cm"];

export const SLAB_STATUS_OPTIONS = ["AVAILABLE", "DISCONTINUED", "UNAVAILABLE"];

/** Mirrors the SlabFinish enum in prisma/schema.prisma. */
export const SLAB_FINISH_OPTIONS = [
  "POLISHED",
  "HONED",
  "MATTE",
  "LEATHER",
  "NATURAL",
  "CONCRETE",
  "DUAL",
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
  "OTHER",
];

const FINISH_SET = new Set(SLAB_FINISH_OPTIONS);

/** Row flags set by the reader (template parser or AI) - shown as warnings in review. */
export type SlabRowFlag =
  | "price-unverified" // AI price not found anywhere in the source text/cells
  | "low-confidence" // AI said it wasn't sure about this row
  | "finish-unrecognized"; // source finish text didn't match a known finish -> OTHER

export type SlabTemplateRow = {
  id: string;
  series: string | null;
  code: string | null;
  color: string;
  finish: string; // one of SLAB_FINISH_OPTIONS
  heightIn: number | null;
  widthIn: number | null;
  thickness: string; // one of SLAB_THICKNESS_OPTIONS, or "" when unknown (blocking error)
  sfPrice: number | null;
  slabPrice: number | null;
  status: string; // one of SLAB_STATUS_OPTIONS
  // Read-only context shown in the review grid
  source?: string | null; // e.g. "Page 3" or "Sheet1 row 14"
  sourceFinish?: string | null;
  sourceThickness?: string | null;
  flags?: SlabRowFlag[];
  note?: string | null;
};

export function fileExtension(fileName: string): string {
  return (fileName.split(".").pop() || "").toLowerCase();
}

export function newRowId(): string {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

/**
 * Map a thickness as printed ("2 cm", "20mm", "3/4\"", "1 1/4", "TWO_CM",
 * "1.2cm"...) to a canonical SLAB_THICKNESS_OPTIONS value, or null when it
 * can't be recognized (callers decide whether to fall back or flag it).
 */
export function normalizeThicknessStrict(input: string | number | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim().toLowerCase();
  if (!raw) return null;

  // Enum spellings
  const enumMap: Record<string, string> = {
    six_mm: "6mm",
    eight_mm: "8mm",
    ten_mm: "10mm",
    twelve_mm: "12mm",
    fifteen_mm: "15mm",
    two_cm: "2cm",
    three_cm: "3cm",
  };
  const enumKey = raw.replace(/[\s-]+/g, "_");
  if (enumMap[enumKey]) return enumMap[enumKey];

  // Inch fractions (US price lists): 3/4" = 2cm, 1 1/4" = 3cm, 1/2" = 12mm
  if (/^(1\s*[- ]\s*1\/4|1\.25)\s*("|in|”|″)?/.test(raw)) return "3cm";
  if (/^(3\/4|0?\.75)\s*("|in|”|″)?$/.test(raw)) return "2cm";
  if (/^(1\/2|0?\.5)\s*("|in|”|″)$/.test(raw)) return "12mm";

  const compact = raw.replace(/\s+/g, "");
  const mmByValue: Record<number, string> = {
    6: "6mm",
    8: "8mm",
    10: "10mm",
    12: "12mm",
    15: "15mm",
    20: "2cm",
    30: "3cm",
  };

  const unit = compact.match(/(\d+(?:\.\d+)?)(mm|cm)/);
  if (unit) {
    const value = parseFloat(unit[1]);
    const mm = Math.round(unit[2] === "cm" ? value * 10 : value);
    if (mmByValue[mm]) return mmByValue[mm];
  }

  // Bare numbers: 2/3 = cm, 6..30 = mm
  if (/^\d+(\.\d+)?$/.test(compact)) {
    const value = parseFloat(compact);
    if (value === 2) return "2cm";
    if (value === 3) return "3cm";
    if (mmByValue[Math.round(value)] && value >= 6) return mmByValue[Math.round(value)];
  }

  return null;
}

/** Map a finish as printed to a SlabFinish enum value. */
export function normalizeFinishStrict(input: string | null | undefined): {
  finish: string;
  recognized: boolean;
} {
  const normalized = String(input ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) return { finish: "POLISHED", recognized: false };
  if (FINISH_SET.has(normalized)) return { finish: normalized, recognized: true };

  if (normalized.includes("SOFT_TOUCH")) return { finish: "SOFT_TOUCH", recognized: true };
  if (normalized.includes("MATTE")) return { finish: "MATTE", recognized: true };
  if (normalized.includes("POLISH")) return { finish: "POLISHED", recognized: true };
  if (normalized.includes("HONED")) return { finish: "HONED", recognized: true };
  if (normalized.includes("LEATHER")) return { finish: "LEATHER", recognized: true };
  if (normalized.includes("NATURAL")) return { finish: "NATURAL", recognized: true };
  if (normalized.includes("CONCRETE")) return { finish: "CONCRETE", recognized: true };
  if (normalized.includes("ROUGH")) return { finish: "ROUGH", recognized: true };

  return { finish: "OTHER", recognized: false };
}

export function normalizeStatus(input: string | null | undefined): string {
  const upper = String(input ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (SLAB_STATUS_OPTIONS.includes(upper)) return upper;
  if (upper.startsWith("DISC")) return "DISCONTINUED";
  if (upper.startsWith("UNAVAIL") || upper === "N/A" || upper === "OUT") return "UNAVAILABLE";
  return "AVAILABLE";
}

/** "$1,234.50" / 1234.5 / "" -> number | null */
export function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function parseInches(value: unknown): number | null {
  const num = parseMoney(value);
  return num !== null && num > 0 ? num : null;
}

/* ------------------------------------------------------------------ */
/* Derived values (kept identical to slabsImport.normalizeImportRow)   */
/* ------------------------------------------------------------------ */

export function computeSquareFeet(heightIn: number | null, widthIn: number | null): number {
  if (!heightIn || !widthIn) return 0;
  return Math.round(((heightIn * widthIn) / 144) * 10) / 10;
}

/** Per-slab provider price: Slab_Price wins, otherwise SF x SF_Price. */
export function computeListedPrice(row: Pick<SlabTemplateRow, "heightIn" | "widthIn" | "sfPrice" | "slabPrice">): number {
  if (row.slabPrice != null && row.slabPrice > 0) return row.slabPrice;
  if (row.sfPrice != null && row.sfPrice > 0) {
    return Math.round(computeSquareFeet(row.heightIn, row.widthIn) * row.sfPrice * 100) / 100;
  }
  return 0;
}

/**
 * Slab size as an order-independent key ("130x65" == "65x130"), rounded to
 * the nearest half inch so 130 vs 130.0 or tiny rounding noise still match.
 */
export function slabSizeKey(heightIn: number | null | undefined, widthIn: number | null | undefined): string {
  if (!heightIn || !widthIn) return "?";
  const long = Math.round(Math.max(heightIn, widthIn) * 2) / 2;
  const short = Math.round(Math.min(heightIn, widthIn) * 2) / 2;
  return `${long}x${short}`;
}

/**
 * What makes a row a distinct slab within one brand: color + finish +
 * thickness + SIZE + supplier code. The same color/finish/thickness sold as
 * a full slab and a half slab (different size and code) are two separate
 * slabs, not duplicates.
 */
export function rowIdentityKey(
  row: Pick<SlabTemplateRow, "color" | "finish" | "thickness" | "heightIn" | "widthIn" | "code">,
): string {
  return [
    row.color.trim().toLowerCase(),
    row.finish.toLowerCase(),
    row.thickness.toLowerCase(),
    slabSizeKey(row.heightIn, row.widthIn),
    (row.code || "").trim().toLowerCase(),
  ].join("|");
}

/* ------------------------------------------------------------------ */
/* Size vs. price check                                                */
/* ------------------------------------------------------------------ */

/** Relative tolerance when comparing a slab's area with slab price / SF price. */
export const SIZE_CHECK_TOLERANCE = 0.02;

/**
 * When a list gives BOTH an SF price and a slab price, slab / SF is the slab's
 * square footage - an independent check that the row has the right size
 * (e.g. 1188.27 / 20.25 = 58.68 SF = 65 x 130, not 56 x 119).
 */
export function impliedSquareFeet(row: Pick<SlabTemplateRow, "sfPrice" | "slabPrice">): number | null {
  if (!(row.sfPrice && row.sfPrice > 0 && row.slabPrice && row.slabPrice > 0)) return null;
  return row.slabPrice / row.sfPrice;
}

export function areasMatch(a: number, b: number, tolerance = SIZE_CHECK_TOLERANCE): boolean {
  if (!(a > 0 && b > 0)) return false;
  return Math.abs(a - b) / Math.max(a, b) <= tolerance;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export type RowIssue = {
  level: "error" | "warning";
  code:
    | "missing-color"
    | "missing-size"
    | "missing-price"
    | "missing-thickness"
    | "duplicate"
    | "price-unverified"
    | "low-confidence"
    | "finish-unrecognized"
    | "size-mismatch";
  message: string;
};

export function computeRowIssues(rows: SlabTemplateRow[]): Record<string, RowIssue[]> {
  const result: Record<string, RowIssue[]> = {};
  const keyCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.color.trim() || !row.thickness) continue;
    const key = rowIdentityKey(row);
    keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
  }

  for (const row of rows) {
    const issues: RowIssue[] = [];
    if (!row.color.trim()) {
      issues.push({ level: "error", code: "missing-color", message: "Color is required" });
    }
    if (!row.heightIn || !row.widthIn) {
      issues.push({ level: "error", code: "missing-size", message: "Height and width are required" });
    }
    if (!(row.sfPrice != null && row.sfPrice > 0) && !(row.slabPrice != null && row.slabPrice > 0)) {
      issues.push({ level: "error", code: "missing-price", message: "Enter an SF price or a slab price" });
    }
    if (!SLAB_THICKNESS_OPTIONS.includes(row.thickness)) {
      issues.push({
        level: "error",
        code: "missing-thickness",
        message: row.sourceThickness
          ? `Thickness "${row.sourceThickness}" not recognized - pick one`
          : "Pick a thickness",
      });
    }
    if (row.color.trim() && row.thickness && (keyCounts.get(rowIdentityKey(row)) || 0) > 1) {
      issues.push({
        level: "error",
        code: "duplicate",
        message: "Same color, finish, thickness, size and code appears more than once - keep only one",
      });
    }
    const flags = row.flags || [];
    if (flags.includes("price-unverified")) {
      issues.push({
        level: "warning",
        code: "price-unverified",
        message: "Price not found in the source file - double-check it",
      });
    }
    if (flags.includes("low-confidence")) {
      issues.push({
        level: "warning",
        code: "low-confidence",
        message: row.note ? `AI unsure: ${row.note}` : "AI was not sure about this row",
      });
    }
    if (flags.includes("finish-unrecognized") && row.finish === "OTHER") {
      issues.push({
        level: "warning",
        code: "finish-unrecognized",
        message: `Finish "${row.sourceFinish || ""}" not recognized - saved as OTHER`,
      });
    }
    const implied = impliedSquareFeet(row);
    if (implied !== null && row.heightIn && row.widthIn) {
      const actual = (row.heightIn * row.widthIn) / 144;
      if (!areasMatch(implied, actual, SIZE_CHECK_TOLERANCE)) {
        issues.push({
          level: "warning",
          code: "size-mismatch",
          message: `Prices work out to ${implied.toFixed(2)} SF per slab, but ${row.heightIn} x ${row.widthIn} is ${actual.toFixed(2)} SF - check the size/code`,
        });
      }
    }
    if (issues.length > 0) result[row.id] = issues;
  }
  return result;
}

export function countBlockingErrors(issues: Record<string, RowIssue[]>): number {
  return Object.values(issues).filter((list) => list.some((i) => i.level === "error")).length;
}

/* ------------------------------------------------------------------ */
/* Template file <-> rows                                              */
/* ------------------------------------------------------------------ */

type Grid = (string | number | null)[][];

function headerKey(cell: unknown): string {
  return String(cell ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const HEADER_ALIASES: Record<string, string> = {
  brand: "brand",
  series: "series",
  code: "code",
  color: "color",
  colour: "color",
  finish: "finish",
  h: "h",
  height: "h",
  w: "w",
  width: "w",
  thickness: "thickness",
  sfprice: "sfPrice",
  slabprice: "slabPrice",
  status: "status",
};

/** Column map when this row is a GMD template header row, otherwise null. */
export function matchTemplateHeader(row: (string | number | null)[] | undefined): Record<string, number> | null {
  if (!row) return null;
  const map: Record<string, number> = {};
  row.forEach((cell, idx) => {
    const key = HEADER_ALIASES[headerKey(cell)];
    if (key && map[key] === undefined) map[key] = idx;
  });
  const hasCore = map.color !== undefined && map.finish !== undefined && map.thickness !== undefined;
  const hasPrice = map.sfPrice !== undefined || map.slabPrice !== undefined;
  return hasCore && hasPrice ? map : null;
}

/**
 * Deterministic reader for a file already in the GMD template. Skips blank
 * rows and rows with no color. Unlike the old importer it never silently
 * turns an unknown thickness into 2cm - it leaves it blank so the review
 * screen forces a choice.
 */
export function parseTemplateGrid(grid: Grid, sheetName: string, rowOffset = 0): SlabTemplateRow[] {
  const map = matchTemplateHeader(grid[0]);
  if (!map) return [];
  const cell = (row: (string | number | null)[], key: string) =>
    map[key] === undefined ? null : row[map[key]] ?? null;
  const text = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v).trim();
    return s || null;
  };

  const rows: SlabTemplateRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const color = text(cell(r, "color"));
    if (!color) continue;
    const sfPrice = parseMoney(cell(r, "sfPrice"));
    const slabPrice = parseMoney(cell(r, "slabPrice"));
    const rawFinish = text(cell(r, "finish"));
    const rawThickness = text(cell(r, "thickness"));
    const { finish, recognized } = normalizeFinishStrict(rawFinish);
    const flags: SlabRowFlag[] = [];
    if (rawFinish && !recognized) flags.push("finish-unrecognized");

    rows.push({
      id: newRowId(),
      series: text(cell(r, "series")),
      code: text(cell(r, "code")),
      color,
      finish,
      heightIn: parseInches(cell(r, "h")),
      widthIn: parseInches(cell(r, "w")),
      thickness: normalizeThicknessStrict(rawThickness) || "",
      sfPrice: sfPrice && sfPrice > 0 ? sfPrice : null,
      slabPrice: slabPrice && slabPrice > 0 ? slabPrice : null,
      status: normalizeStatus(text(cell(r, "status"))),
      source: `${sheetName} row ${i + 1 + rowOffset}`,
      sourceFinish: rawFinish,
      sourceThickness: rawThickness,
      flags,
      note: null,
    });
  }
  return rows;
}

/** Array-of-arrays (header + rows) ready for XLSX.utils.aoa_to_sheet. */
export function rowsToTemplateAoa(
  rows: Pick<
    SlabTemplateRow,
    "series" | "code" | "color" | "finish" | "heightIn" | "widthIn" | "thickness" | "sfPrice" | "slabPrice" | "status"
  >[],
  brandName: string,
): (string | number | null)[][] {
  return [
    [...SLAB_TEMPLATE_HEADERS],
    ...rows.map((r) => [
      brandName,
      r.series ?? "",
      r.code ?? "",
      r.color,
      r.finish,
      r.heightIn ?? "",
      r.widthIn ?? "",
      r.thickness,
      r.sfPrice ?? "",
      r.slabPrice ?? "",
      r.status,
    ]),
  ];
}

export const SLAB_TEMPLATE_COL_WIDTHS = [14, 14, 12, 28, 14, 7, 7, 10, 10, 11, 13];

export function templateFileName(brandName: string, suffix: string): string {
  const safe = brandName.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "brand";
  const date = new Date().toISOString().slice(0, 10);
  return `${safe}_${suffix}_${date}.xlsx`;
}

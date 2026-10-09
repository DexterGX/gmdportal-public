/**
 * Client-safe helpers for cabinet price lists that arrive as a PDF.
 *
 * The AI (cabinetPdfImportAi.ts) transcribes each few-page chunk of the PDF
 * into a small table - a header row of column names plus one row per product
 * line. This merges those chunk tables into ONE grid shaped like a spreadsheet
 * sheet, so the existing import pipeline (parse plan -> applyParsePlan -> diff)
 * runs on it unchanged.
 *
 * Many door-style price lists print their colors on the first pages (grouped
 * under "LEVEL 1", "LEVEL 2", ...) and only the per-level prices on the later
 * pages. The chunk reader reports both; expandLevelColumns() then turns every
 * "Level n" price column into one column per color ("Lv1 - White Oak VTW").
 */

import type { CabinetImportParsePlan, RawGrid } from "./cabinetCatalogImport";

export type PdfTableChunk = {
  columns: string[];
  rows: string[][];
};

/** A color/finish swatch read off the PDF, with the level it is sold under. */
export type PdfColor = {
  level: number | null;
  name: string;
  code: string;
};

function columnKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * "LEVEL 1", "Level 1 Full Cabinet", "Lv1", "Lv 1 - Full Cabinet" -> level 1.
 * Anything after the number is a sub-heading; "Full Cabinet" is the usual
 * (and only) one, so it is not treated as a distinguishing sub-heading.
 */
export function parseLevelHeading(name: string): { level: number; sub: string } | null {
  const m = name.trim().match(/^(?:level|lvl|lv)\.?\s*(\d+)\s*(?:[-–:]\s*)?(.*)$/i);
  if (!m) return null;
  const level = parseInt(m[1], 10);
  if (!Number.isFinite(level)) return null;
  let sub = m[2].trim();
  if (/^(?:full\s+)?cabinets?$/i.test(sub)) sub = "";
  return { level, sub };
}

function canonicalColumnName(name: string): string {
  const parsed = parseLevelHeading(name);
  if (!parsed) return name.trim();
  return parsed.sub ? `Level ${parsed.level} - ${parsed.sub}` : `Level ${parsed.level}`;
}

/**
 * Merge chunk tables (in page order) into one grid. Columns are matched by
 * name across chunks (first chunk's order wins, new columns are appended);
 * "Level 1" / "LEVEL 1 Full Cabinet" / "Lv1" count as the same column;
 * a row with no Category inherits the previous row's, so a section that runs
 * across a chunk boundary keeps its heading; repeated header rows are dropped.
 */
export function mergePdfTables(chunks: (PdfTableChunk | undefined | null)[]): RawGrid {
  const columns: string[] = [];
  const indexByKey = new Map<string, number>();
  for (const chunk of chunks) {
    for (const rawName of chunk?.columns || []) {
      const name = canonicalColumnName(rawName);
      const key = columnKey(name);
      if (!key || indexByKey.has(key)) continue;
      indexByKey.set(key, columns.length);
      columns.push(name);
    }
  }
  if (columns.length === 0) return [];

  const categoryIndex = indexByKey.get("category");
  const body: string[][] = [];
  let lastCategory = "";

  for (const chunk of chunks) {
    if (!chunk) continue;
    const map = chunk.columns.map((name) => indexByKey.get(columnKey(canonicalColumnName(name))) ?? -1);
    for (const row of chunk.rows) {
      const out: string[] = new Array(columns.length).fill("");
      row.forEach((cell, i) => {
        const target = map[i];
        if (target !== undefined && target >= 0) out[target] = String(cell ?? "").trim();
      });
      // A reprinted heading row ("Code", "Description", ...).
      if (out.every((cell, i) => !cell || columnKey(cell) === columnKey(columns[i]))) continue;
      if (categoryIndex !== undefined) {
        if (out[categoryIndex]) lastCategory = out[categoryIndex];
        else out[categoryIndex] = lastCategory;
      }
      body.push(out);
    }
  }

  return [columns, ...body].map((row) => row.map((cell) => (cell === "" ? null : cell)));
}

/**
 * Colors read from every chunk, in page order. A swatch whose level heading
 * was on an earlier page (level === null) inherits the level of the swatch
 * before it. Duplicates (same level + code) are dropped.
 */
export function collectPdfColors(perChunk: (PdfColor[] | undefined | null)[]): PdfColor[] {
  const out: PdfColor[] = [];
  const seen = new Set<string>();
  let currentLevel: number | null = null;
  for (const colors of perChunk) {
    for (const c of colors || []) {
      const name = String(c?.name ?? "").trim();
      const code = String(c?.code ?? "").trim();
      if (!name && !code) continue;
      const level: number | null =
        typeof c.level === "number" && Number.isInteger(c.level) && c.level > 0 ? c.level : currentLevel;
      if (level !== null) currentLevel = level;
      const key = `${level ?? "?"}|${(code || name).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ level, name, code });
    }
  }
  return out;
}

// "/" and "," split a header into several tiers in the import, so keep them
// out of color names ("Black/White" would become two tiers).
function colorLabel(color: PdfColor): string {
  const name = color.name.replace(/[/,]+/g, " ").replace(/\s+/g, " ").trim();
  const code = color.code.replace(/[/,]+/g, " ").replace(/\s+/g, " ").trim();
  if (name && code && !name.toLowerCase().includes(code.toLowerCase())) return `${name} ${code}`;
  return name || code;
}

function levelTierName(level: number, sub: string): string {
  return sub ? `Lv${level} - ${sub}` : `Lv${level}`;
}

/**
 * Replaces each "Level n" price column with one column per color of that
 * level - "Lv1 - White Oak VTW" - each carrying that level's prices. Levels
 * with no colors keep a single "Lv1" column. Returns notes for the admin.
 */
export function expandLevelColumns(
  grid: RawGrid,
  colors: PdfColor[],
): { grid: RawGrid; notes: string[] } {
  const notes: string[] = [];
  if (grid.length === 0) return { grid, notes };
  const header = grid[0].map((c) => (c === null ? "" : String(c)));
  const levelOf = header.map((h) => parseLevelHeading(h));
  if (!levelOf.some(Boolean)) return { grid, notes };

  const colorsByLevel = new Map<number, PdfColor[]>();
  for (const c of colors) {
    if (c.level === null) continue;
    const list = colorsByLevel.get(c.level) || [];
    list.push(c);
    colorsByLevel.set(c.level, list);
  }
  const unplaced = colors.filter((c) => c.level === null).length;
  if (unplaced > 0) {
    notes.push(
      `${unplaced} color${unplaced === 1 ? "" : "s"} in the PDF had no level heading and ${unplaced === 1 ? "was" : "were"} left out. Add a note saying which level they belong to and click "Re-read with notes".`,
    );
  }
  if (colors.length === 0) {
    notes.push(
      "No colors were found in the PDF, so prices are listed per level (Lv1, Lv2, ...) instead of per color. If the colors are on the first pages, mention that in the notes and click \"Re-read with notes\".",
    );
  }

  // Which output columns each source column becomes.
  const plan: { source: number; header: string }[] = [];
  const usedLevels = new Set<number>();
  header.forEach((h, c) => {
    const lv = levelOf[c];
    if (!lv) {
      plan.push({ source: c, header: h });
      return;
    }
    const list = colorsByLevel.get(lv.level) || [];
    if (list.length === 0) {
      plan.push({ source: c, header: levelTierName(lv.level, lv.sub) });
      return;
    }
    usedLevels.add(lv.level);
    for (const color of list) {
      plan.push({ source: c, header: `Lv${lv.level} - ${colorLabel(color)}${lv.sub ? ` - ${lv.sub}` : ""}` });
    }
  });

  const noPriceColumn = Array.from(colorsByLevel.keys()).filter((level) => !usedLevels.has(level));
  if (noPriceColumn.length > 0) {
    notes.push(
      `Colors were found for level ${noPriceColumn.sort((a, b) => a - b).join(", ")} but the price tables have no column for ${
        noPriceColumn.length === 1 ? "that level" : "those levels"
      }, so ${noPriceColumn.length === 1 ? "it was" : "they were"} skipped.`,
    );
  }

  // Two colors can share a label; keep every header unique.
  const seen = new Map<string, number>();
  for (const p of plan) {
    const key = p.header.toLowerCase();
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    if (n > 1) p.header = `${p.header} (${n})`;
  }

  const expanded: RawGrid = grid.map((row, r) =>
    plan.map((p) => (r === 0 ? p.header : (row[p.source] ?? null))),
  );
  const colorColumns = plan.filter((p) => levelOf[p.source] && /^Lv\d+ - /.test(p.header)).length;
  if (colorColumns > 0) {
    notes.push(
      `Built ${colorColumns} price columns - one per color, named like "Lv1 - White Oak VTW" - from the color pages and the per-level prices.`,
    );
  }
  return { grid: expanded, notes };
}

export type PdfPlanStructure = Pick<
  CabinetImportParsePlan,
  | "sheetName"
  | "dataStartRow"
  | "codeCol"
  | "descriptionCol"
  | "sizeCol"
  | "priceColumns"
  | "categoryMode"
  | "categoryColumn"
  | "sectionDetectColumn"
>;

/**
 * The layout of a grid built by mergePdfTables/expandLevelColumns is known
 * exactly (Category, Code, Description, [Size], then price columns), so the
 * structural part of the parse plan does not need to be guessed by the AI.
 * Returns null when the grid does not have that shape.
 */
export function derivePdfPlanStructure(
  grid: RawGrid,
  sheetName: string,
): { structure: PdfPlanStructure; notes: string[] } | null {
  if (grid.length < 2) return null;
  const header = grid[0].map((c) => (c === null ? "" : String(c).trim()));
  const find = (name: string) => header.findIndex((h) => h.toLowerCase() === name);
  const codeCol = find("code");
  const descriptionCol = find("description");
  if (codeCol < 0 || descriptionCol < 0) return null;
  const categoryCol = find("category");
  const sizeCol = find("size");
  const notes: string[] = [];

  const hasLevelColumns = header.some((h) => /^lv\d+\b/i.test(h));
  const priceColumns: { col: number; tierName: string }[] = [];
  header.forEach((h, col) => {
    const lower = h.toLowerCase();
    if (!h || col === codeCol || col === descriptionCol || col === categoryCol || col === sizeCol) return;
    if (hasLevelColumns && lower === "box") {
      notes.push('Skipped the "Box" price column - it is not tied to a level or color. Say so in the notes if you want it imported.');
      return;
    }
    priceColumns.push({ col, tierName: h });
  });
  if (priceColumns.length === 0) return null;

  return {
    structure: {
      sheetName,
      dataStartRow: 1,
      codeCol,
      descriptionCol,
      sizeCol: sizeCol >= 0 ? sizeCol : null,
      priceColumns,
      categoryMode: categoryCol >= 0 ? "column" : "none",
      categoryColumn: categoryCol >= 0 ? categoryCol : null,
      sectionDetectColumn: null,
    },
    notes,
  };
}

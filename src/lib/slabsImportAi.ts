/**
 * AI-assisted reading of slab supplier price lists (PDF / Excel / CSV) into
 * GMD's slab import template (see slabsTemplate.ts).
 *
 * Two strategies:
 *
 *  1. SPREADSHEETS -> "layout plan" (same idea as the cabinet importer).
 *     Claude looks at the sheet ONCE and describes its layout: which column
 *     holds the color, which holds the group/series, and which column pairs
 *     hold SF/slab prices for which thickness + size + code. The app then
 *     reads EVERY row of the sheet itself, so prices come straight from the
 *     cells (no transcription errors), the whole file takes one short AI call
 *     instead of dozens of long ones, and series/sizes are applied
 *     consistently to every row. Merged cells (e.g. a group letter merged
 *     down a block of colors, a size heading merged across columns) are
 *     expanded first so every row sees its own group and every column its
 *     own heading.
 *
 *  2. PDFs (and spreadsheets whose layout isn't a regular grid) -> Claude
 *     reads the rows directly, a few pages / rows at a time. The output is
 *     "column groups + one entry per color with its prices", which is far
 *     more compact than one full object per slab (a color sold in 8 size/
 *     thickness combos is written once, not 8 times). Every price is checked
 *     against the numbers actually in that part of the file.
 *
 * Nothing is saved here - the admin reviews/edits the rows first.
 */

import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  SLAB_FINISH_OPTIONS,
  SLAB_STATUS_OPTIONS,
  SLAB_THICKNESS_OPTIONS,
  fileExtension,
  matchTemplateHeader,
  newRowId,
  normalizeFinishStrict,
  normalizeStatus,
  normalizeThicknessStrict,
  parseTemplateGrid,
  areasMatch,
  type SlabRowFlag,
  type SlabTemplateRow,
} from "./slabsTemplate";

const MODEL = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 20000;
const PLAN_MAX_OUTPUT_TOKENS = 6000;

const PDF_PAGES_PER_CHUNK = 2;
const MAX_PDF_PAGES = 80;
// Raw-byte ceiling for one chunk's PDF (base64 adds ~33%; the API caps the
// whole request around 32MB) - same budget cabinetCatalogPdf.ts uses.
const MAX_CHUNK_BYTES = 16 * 1024 * 1024;

const SHEET_ROWS_PER_CHUNK = 60;
const SHEET_HEADER_CONTEXT_ROWS = 12;
const SHEET_PRECEDING_CONTEXT_ROWS = 40;
const MIN_SPLIT_ROWS = 10;
const MAX_CHUNKS = 40;
const MAX_EXISTING_HINTS = 400;
// Layout plan: how much of each sheet Claude sees (it only needs enough to
// understand the layout; the app reads every row afterwards).
const PLAN_MAX_ROWS_PER_SHEET = 400;
const PLAN_MAX_PROMPT_CHARS = 160_000;
const MAX_CELL_CHARS = 60;

type Cell = string | number | null;
type Grid = Cell[][];
type SlabSheet = { sheetName: string; grid: Grid };

/* ------------------------------------------------------------------ */
/* Reading spreadsheets                                                */
/* ------------------------------------------------------------------ */

function normalizeCell(cell: unknown): Cell {
  if (cell === undefined || cell === null || cell === "") return null;
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  const str = String(cell).trim();
  return str === "" ? null : str;
}

function padGrid(rows: unknown[][]): Grid {
  const normalized = rows.map((row) => (row || []).map(normalizeCell));
  const width = normalized.reduce((max, row) => Math.max(max, row.length), 0);
  return normalized.map((row) =>
    row.length < width ? [...row, ...Array<Cell>(width - row.length).fill(null)] : row,
  );
}

/**
 * Grid indexes match the real sheet: grid[r][c] is Excel row r+1, column
 * encode_col(c) - so "row 91, column R" means the same thing to Claude, the
 * app and the admin looking at the file. Merged cells are expanded so every
 * cell in a merge carries the merge's value.
 */
export function readSlabSheets(buffer: ArrayBuffer, fileName: string): SlabSheet[] {
  const ext = fileExtension(fileName);
  const data = new Uint8Array(buffer);

  if (ext === "csv") {
    const text = new TextDecoder().decode(data);
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
    return [{ sheetName: "Sheet1", grid: padGrid(parsed.data as unknown[][]) }];
  }
  if (ext !== "xlsx" && ext !== "xls") {
    throw new Error("Unsupported file format. Use PDF, CSV, XLS, or XLSX.");
  }

  const workbook = XLSX.read(data, { type: "array" });
  return workbook.SheetNames.map((sheetName) => {
    const ws = workbook.Sheets[sheetName];
    if (!ws || !ws["!ref"]) return { sheetName, grid: [] };
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: true,
      range: { s: { r: 0, c: 0 }, e: range.e },
    });
    const grid = padGrid(raw);
    for (const merge of ws["!merges"] || []) {
      const value = grid[merge.s.r]?.[merge.s.c] ?? null;
      if (value === null) continue;
      if ((merge.e.r - merge.s.r + 1) * (merge.e.c - merge.s.c + 1) > 5000) continue;
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          if (grid[r] && grid[r][c] === null) grid[r][c] = value;
        }
      }
    }
    return { sheetName, grid };
  });
}

function isRowEmpty(row: Cell[] | undefined) {
  return !row || row.every((c) => c === null);
}

function firstNonEmptyRow(grid: Grid): number {
  for (let i = 0; i < grid.length; i++) if (!isRowEmpty(grid[i])) return i;
  return -1;
}

function lastNonEmptyRow(grid: Grid): number {
  for (let i = grid.length - 1; i >= 0; i--) if (!isRowEmpty(grid[i])) return i;
  return -1;
}

function hasNumbers(grid: Grid): boolean {
  return grid.some((row) =>
    row.some((c) => typeof c === "number" || (typeof c === "string" && /\d/.test(c))),
  );
}

/** "R91: C=Olympus Honed* | R=20.25 | S=1188.27" - empty cells left out. */
function renderRows(grid: Grid, start: number, end: number): string {
  const lines: string[] = [];
  for (let i = Math.max(0, start); i <= end && i < grid.length; i++) {
    const row = grid[i];
    if (isRowEmpty(row)) continue;
    const cells: string[] = [];
    row.forEach((c, col) => {
      if (c === null) return;
      const text = String(c).replace(/\s+/g, " ");
      cells.push(`${XLSX.utils.encode_col(col)}=${text.length > MAX_CELL_CHARS ? `${text.slice(0, MAX_CELL_CHARS)}…` : text}`);
    });
    lines.push(`R${i + 1}: ${cells.join(" | ")}`);
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Planning                                                            */
/* ------------------------------------------------------------------ */

export type ImportChunk =
  | { index: number; kind: "pdf"; startPage: number; pageCount: number; label: string }
  | { index: number; kind: "sheet-plan"; label: string }
  | { index: number; kind: "sheet"; sheetName: string; startRow: number; endRow: number; label: string };

export type ImportPlan =
  | { kind: "template"; sheetName: string; rows: SlabTemplateRow[]; warnings: string[] }
  | { kind: "pdf"; totalPages: number; chunks: ImportChunk[]; fallbackChunks: ImportChunk[]; warnings: string[] }
  | { kind: "sheet"; chunks: ImportChunk[]; fallbackChunks: ImportChunk[]; warnings: string[] };

/**
 * Decide how a file will be read. Deterministic and cheap, so the extract
 * route simply re-runs it to find its chunk instead of trusting anything
 * the browser sends back about the chunk's boundaries.
 *
 * Spreadsheets get ONE "layout" chunk (index 0). Only if Claude says the
 * layout isn't a regular grid does the browser fall back to the row-by-row
 * chunks in fallbackChunks.
 */
export async function planSlabImport(buffer: ArrayBuffer, fileName: string): Promise<ImportPlan> {
  const ext = fileExtension(fileName);

  if (ext === "pdf") {
    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    } catch {
      throw new Error("This PDF could not be opened. Is it a valid, non-password-protected PDF?");
    }
    const totalPages = doc.getPageCount();
    if (totalPages === 0) throw new Error("This PDF has no pages.");
    const warnings: string[] = [];
    const pages = Math.min(totalPages, MAX_PDF_PAGES);
    if (pages < totalPages) {
      warnings.push(
        `Only the first ${pages} of ${totalPages} pages will be read. Split the PDF and import the rest separately.`,
      );
    }
    const chunks: ImportChunk[] = [];
    for (let start = 1; start <= pages; start += PDF_PAGES_PER_CHUNK) {
      const count = Math.min(PDF_PAGES_PER_CHUNK, pages - start + 1);
      chunks.push({
        index: chunks.length,
        kind: "pdf",
        startPage: start,
        pageCount: count,
        label: count === 1 ? `page ${start}` : `pages ${start}-${start + count - 1}`,
      });
    }
    return { kind: "pdf", totalPages, chunks, fallbackChunks: [], warnings };
  }

  const sheets = readSlabSheets(buffer, fileName);

  // Already in the GMD template? Read it directly - no AI.
  for (const sheet of sheets) {
    const headerRow = firstNonEmptyRow(sheet.grid);
    if (headerRow >= 0 && matchTemplateHeader(sheet.grid[headerRow])) {
      return {
        kind: "template",
        sheetName: sheet.sheetName,
        rows: parseTemplateGrid(sheet.grid.slice(headerRow), sheet.sheetName, headerRow),
        warnings: [],
      };
    }
  }

  const fallbackChunks: ImportChunk[] = [];
  const warnings: string[] = [];
  for (const sheet of sheets) {
    const first = firstNonEmptyRow(sheet.grid);
    const last = lastNonEmptyRow(sheet.grid);
    if (last < 0 || !hasNumbers(sheet.grid)) continue;
    for (let start = first; start <= last; start += SHEET_ROWS_PER_CHUNK) {
      if (fallbackChunks.length >= MAX_CHUNKS) break;
      const end = Math.min(last, start + SHEET_ROWS_PER_CHUNK - 1);
      if (sheet.grid.slice(start, end + 1).every((r) => isRowEmpty(r))) continue;
      fallbackChunks.push({
        index: fallbackChunks.length + 1, // 0 is the layout chunk
        kind: "sheet",
        sheetName: sheet.sheetName,
        startRow: start,
        endRow: end,
        label: `${sheets.length > 1 ? `"${sheet.sheetName}" ` : ""}rows ${start + 1}-${end + 1}`,
      });
    }
  }
  if (fallbackChunks.length === 0) {
    throw new Error("No sheet in this file seems to contain any prices.");
  }
  if (fallbackChunks.length >= MAX_CHUNKS) {
    warnings.push(`This file is very large - only part of it can be read row by row if its layout isn't a regular grid.`);
  }
  return {
    kind: "sheet",
    chunks: [{ index: 0, kind: "sheet-plan", label: "layout" }],
    fallbackChunks,
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/* Shared types / helpers                                              */
/* ------------------------------------------------------------------ */

export type ExistingSlabHint = {
  color: string;
  finish: string;
  thickness: string;
  heightIn: number;
  widthIn: number;
  series: string | null;
  code: string | null;
};

export type ExtractContext = {
  brandName: string;
  existingSlabs: ExistingSlabHint[];
  notes: string | null;
};

export type ExtractResult = {
  rows: SlabTemplateRow[];
  warnings: string[];
  observations: string[];
  priceCheck: "checked" | "unavailable";
  /** Spreadsheet layout couldn't be mapped - browser should run fallbackChunks. */
  fallback?: boolean;
};

function dedupeHints(hints: ExistingSlabHint[]): ExistingSlabHint[] {
  const seen = new Set<string>();
  const out: ExistingSlabHint[] = [];
  for (const h of hints) {
    const key = `${h.color.toLowerCase()}|${h.finish}|${h.thickness}|${h.heightIn}x${h.widthIn}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

function sharedIntro(ctx: ExtractContext): string {
  const existing = dedupeHints(ctx.existingSlabs).slice(0, MAX_EXISTING_HINTS);
  const existingSection =
    existing.length > 0
      ? `GMD's CURRENT price list for ${ctx.brandName} (color | finish | thickness | size | series | code) - ` +
        `reuse these exact color spellings when a color is clearly the same:\n` +
        existing
          .map(
            (s) =>
              `- ${s.color} | ${s.finish} | ${s.thickness} | ${s.heightIn}x${s.widthIn} | ${s.series ?? ""} | ${s.code ?? ""}`,
          )
          .join("\n") +
        "\n\n"
      : `GMD has no slabs for ${ctx.brandName} yet.\n\n`;

  const notesSection = ctx.notes?.trim()
    ? `NOTES FROM THE ADMIN - follow these exactly; they override every default below:\n${ctx.notes.trim()}\n\n`
    : "";

  return (
    `You are helping import a countertop slab supplier's price list (quartz, granite, marble, porcelain, ` +
    `sintered stone...) for the brand "${ctx.brandName}" into GMD's template, which has one row per sellable ` +
    `slab: Series | Code | Color | Finish | H | W | Thickness | SF_Price | Slab_Price | Status.\n\n` +
    notesSection +
    `GENERAL RULES\n` +
    `- A slab is one color x finish x thickness x size. A color sold as a full slab and a half slab, or in ` +
    `2cm and 3cm, is several slabs.\n` +
    `- Sizes are inches; height = the LONG side, width = the SHORT side. Convert mm/cm (round to 0.5"). ` +
    `Sizes are usually printed once in a column or section heading - apply them to everything under it.\n` +
    `- Thickness: 2cm (= 20mm = 3/4"), 3cm (= 30mm = 1 1/4"), or 6/8/10/12/15mm for thin porcelain.\n` +
    `- Prices: per square foot -> SF price; per slab / each -> slab price. Never calculate or convert prices. ` +
    `If there are several price levels (dealer/fabricator vs retail/MSRP, bundle vs single slab), use the ` +
    `fabricator/dealer single-slab price unless the admin's notes say otherwise.\n` +
    `- Finish: when a color name ends with a finish word ("Olympus Honed", "Terreno Brushed") that word is ` +
    `the finish, not part of the color - unless GMD's current list has the full name as the color. Default ` +
    `finish is POLISHED.\n` +
    `- Series = collection / group / price group (e.g. a group letter column). Code = supplier SKU or code.\n` +
    `- Skip anything that isn't a slab: sinks, adhesives, edges, fabrication charges, samples, freight, totals.\n` +
    `- A cell of "-" or blank means not offered - no slab for that combination.\n\n` +
    existingSection
  );
}

function systemBlocks(text: string): Anthropic.TextBlockParam[] {
  // Same instructions are sent for every chunk of a file - cache them.
  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}

async function streamToolCall(
  client: Anthropic,
  system: string,
  content: Anthropic.MessageParam["content"],
  tool: { name: string; description: string; input_schema: Record<string, unknown> },
  maxTokens: number,
): Promise<{ input: any; truncated: boolean }> {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemBlocks(system),
    tools: [tool as any],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content }],
  });
  const message = await stream.finalMessage();
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  return { input: toolUse?.input || {}, truncated: message.stop_reason === "max_tokens" };
}

/* --------------------------- cleaning values -------------------------- */

const SUFFIX_FINISH_WORDS: Record<string, string> = {
  HONED: "HONED",
  POLISHED: "POLISHED",
  BRUSHED: "BRUSHED",
  MATTE: "MATTE",
  LEATHER: "LEATHER",
  LEATHERED: "LEATHER",
  SUEDE: "SUEDE",
  SATIN: "SATIN",
  VELVET: "VELVET",
  TEXTURED: "TEXTURED",
  ROUGH: "ROUGH",
};

function cleanColor(value: unknown): string {
  return String(value ?? "")
    .replace(/[*†‡®™©¹²³]/g, "")
    .replace(/\((r|tm)\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Olympus Honed" -> { color: "Olympus", finish: "HONED" } unless GMD already uses the full name. */
function splitFinishFromColor(
  color: string,
  existingColors: Map<string, string>,
): { color: string; finish: string | null } {
  const existingFull = existingColors.get(color.toLowerCase());
  const words = color.split(" ");
  const last = words[words.length - 1]?.toUpperCase().replace(/[^A-Z]/g, "") || "";
  const finish = SUFFIX_FINISH_WORDS[last] || null;
  if (existingFull) return { color: existingFull, finish };
  if (finish && words.length > 1) {
    const stripped = words.slice(0, -1).join(" ");
    return { color: existingColors.get(stripped.toLowerCase()) || stripped, finish };
  }
  return { color, finish: null };
}

function buildExistingMaps(hints: ExistingSlabHint[]) {
  const colors = new Map<string, string>(); // lower -> GMD spelling
  const finishes = new Map<string, Set<string>>(); // lower color -> finishes
  for (const h of hints) {
    const key = h.color.trim().toLowerCase();
    colors.set(key, h.color.trim());
    const set = finishes.get(key) || new Set<string>();
    set.add(h.finish);
    finishes.set(key, set);
  }
  return { colors, finishes };
}

function positiveOrNull(value: unknown): number | null {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Strict price cell: a number, or text like "$1,188.27" / "20.25*". "-" / words -> null. */
function cellPrice(value: Cell): number | null {
  if (value === null) return null;
  if (typeof value === "number") return value > 0 ? value : null;
  const cleaned = value.replace(/[$\s,*†]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  return n > 0 ? n : null;
}

function cellText(value: Cell): string | null {
  if (value === null) return null;
  const s = String(value).trim();
  return s || null;
}

function orientSize(h: number | null, w: number | null): [number | null, number | null] {
  if (h && w && w > h) return [w, h];
  return [h, w];
}

/* ----------------------- size check from prices ---------------------- */
//
// When a list prints both an SF price and a slab price, slab / SF is the
// slab's square footage. That lets the app catch (and usually fix) a price
// column the AI tied to the wrong size - e.g. jumbo columns labelled with the
// regular slab's size/code: 1188.27 / 20.25 = 58.68 SF = 65 x 130, not 56 x 119.

const AREA_MATCH_TOLERANCE = 0.015;

type SizeProfile = {
  heightIn: number;
  widthIn: number;
  code: string | null;
  thickness: string | null;
  area: number;
};

const SIZE_IN_TEXT = /(\d{2,3}(?:\.\d+)?)\s*(?:"|''|”|″|in\.?)?\s*[x×X]\s*(\d{2,3}(?:\.\d+)?)/g;

function addProfile(list: SizeProfile[], heightIn: number, widthIn: number, code: string | null, thickness: string | null) {
  const [h, w] = orientSize(heightIn, widthIn) as [number, number];
  if (!(h >= 20 && h <= 200 && w >= 10 && w <= 200)) return;
  if (list.some((p) => p.heightIn === h && p.widthIn === w && p.code === code && p.thickness === thickness)) return;
  list.push({ heightIn: h, widthIn: w, code, thickness, area: (h * w) / 144 });
}

/** Sizes printed in headings ("65\" x 130\" 58.68 SF") - extra candidates when the AI mislabelled a group. */
function addProfilesFromText(list: SizeProfile[], text: string) {
  for (const m of text.matchAll(SIZE_IN_TEXT)) {
    addProfile(list, parseFloat(m[1]), parseFloat(m[2]), null, null);
  }
}

/**
 * Codes the admin tied to sizes in the notes, e.g.
 * "Jum-Half-Slab (size 130x32.5)" or "Reg-Full-Slab (119 x 56)".
 */
function addProfilesFromNotes(list: SizeProfile[], notes: string | null) {
  if (!notes) return;
  const pattern = /([A-Za-z0-9][\w.-]*)\s*\(\s*(?:size\s*:?\s*)?(\d+(?:\.\d+)?)\s*(?:"|in)?\s*[x×X]\s*(\d+(?:\.\d+)?)/g;
  for (const m of notes.matchAll(pattern)) {
    addProfile(list, parseFloat(m[2]), parseFloat(m[3]), m[1], null);
  }
}

function pickProfile(implied: number, thickness: string | null, profiles: SizeProfile[]): SizeProfile | null {
  const matches = profiles.filter((p) => areasMatch(implied, p.area, AREA_MATCH_TOLERANCE));
  if (matches.length === 0) return null;
  const score = (p: SizeProfile) =>
    (p.thickness === thickness ? 0 : 2) + (p.code ? 0 : 1) + Math.abs(p.area - implied) / implied;
  return [...matches].sort((a, b) => score(a) - score(b))[0];
}

/** A code another group already uses for this size (prefer the same thickness). */
function codeForSize(h: number, w: number, thickness: string | null, profiles: SizeProfile[]): string | null {
  const same = profiles.filter((p) => p.code && p.heightIn === h && p.widthIn === w);
  return (same.find((p) => p.thickness === thickness) || same[0])?.code ?? null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/* ------------------------------------------------------------------ */
/* 1. Spreadsheet layout plan                                          */
/* ------------------------------------------------------------------ */

const COLUMN_LETTER = { type: "string", description: "Column letter, e.g. \"C\"." };
const OPTIONAL_COLUMN = { type: ["string", "null"], description: "Column letter, or null if none." };

const PLAN_TOOL = {
  name: "emit_layout_plan",
  description: "Describe the price list's layout so the app can read every row itself.",
  input_schema: {
    type: "object",
    properties: {
      tabular: {
        type: "boolean",
        description:
          "true when slab prices sit in regular columns that can be read row by row (one color per row). " +
          "false for irregular layouts (free text, prices scattered in paragraphs, one size/thickness per row " +
          "written inside the description, etc.).",
      },
      tables: {
        type: "array",
        description:
          "One entry per block of rows that shares the same columns. Usually one per sheet; add another only " +
          "if the columns really change part-way down (a repeated header row with the SAME columns does NOT " +
          "need a new table - the app skips rows without prices).",
        items: {
          type: "object",
          properties: {
            sheetName: { type: "string" },
            firstRow: { type: "integer", description: "First data row number (the number after R)." },
            lastRow: { type: ["integer", "null"], description: "Last data row, or null for the end of the sheet." },
            colorColumn: COLUMN_LETTER,
            seriesColumn: { ...OPTIONAL_COLUMN, description: "Column with the group/collection/series, if any." },
            seriesPrefix: {
              type: ["string", "null"],
              description: "Text put before the series cell value, e.g. \"Group \" turns \"E\" into \"Group E\".",
            },
            seriesValueMap: {
              type: "array",
              description: "Exact series names for specific cell values (overrides seriesPrefix), e.g. {value: \"EX\", series: \"Exotic\"}.",
              items: {
                type: "object",
                properties: { value: { type: "string" }, series: { type: "string" } },
                required: ["value", "series"],
              },
            },
            codeColumn: { ...OPTIONAL_COLUMN, description: "Column with a per-color SKU/code, if any." },
            finishColumn: OPTIONAL_COLUMN,
            statusColumn: OPTIONAL_COLUMN,
            defaultFinish: { type: "string", enum: SLAB_FINISH_OPTIONS },
            priceGroups: {
              type: "array",
              description: "One entry per size x thickness (x price level) that has its own price column(s).",
              items: {
                type: "object",
                properties: {
                  label: { type: "string", description: "Short human label, e.g. \"Regular 56x119 2cm\"." },
                  sfPriceColumn: OPTIONAL_COLUMN,
                  slabPriceColumn: OPTIONAL_COLUMN,
                  thickness: { type: "string", enum: SLAB_THICKNESS_OPTIONS },
                  heightIn: { type: "number" },
                  widthIn: { type: "number" },
                  code: { type: ["string", "null"], description: "Code for every slab in this group, if the notes/list give one." },
                  series: { type: ["string", "null"], description: "Series for every slab in this group - overrides the series column (e.g. a Super Jumbo group)." },
                },
                required: ["label", "sfPriceColumn", "slabPriceColumn", "thickness", "heightIn", "widthIn", "code", "series"],
              },
            },
          },
          required: [
            "sheetName",
            "firstRow",
            "lastRow",
            "colorColumn",
            "seriesColumn",
            "seriesPrefix",
            "seriesValueMap",
            "codeColumn",
            "finishColumn",
            "statusColumn",
            "defaultFinish",
            "priceGroups",
          ],
        },
      },
      observations: {
        type: "array",
        items: { type: "string" },
        description: "Short notes for the admin (which price level you mapped, anything you weren't sure about).",
      },
    },
    required: ["tabular", "tables", "observations"],
  },
};

type PlanTable = {
  sheetName: string;
  firstRow: number;
  lastRow: number | null;
  colorColumn: string;
  seriesColumn: string | null;
  seriesPrefix: string | null;
  seriesValueMap: { value: string; series: string }[];
  codeColumn: string | null;
  finishColumn: string | null;
  statusColumn: string | null;
  defaultFinish: string;
  priceGroups: {
    label: string;
    sfPriceColumn: string | null;
    slabPriceColumn: string | null;
    thickness: string;
    heightIn: number;
    widthIn: number;
    code: string | null;
    series: string | null;
  }[];
};

function colIndex(letter: unknown): number | null {
  if (typeof letter !== "string" || !/^[A-Za-z]{1,3}$/.test(letter.trim())) return null;
  return XLSX.utils.decode_col(letter.trim().toUpperCase());
}

function applyLayoutPlan(
  sheets: SlabSheet[],
  tables: PlanTable[],
  ctx: ExtractContext,
): { rows: SlabTemplateRow[]; warnings: string[] } {
  const rows: SlabTemplateRow[] = [];
  const warnings: string[] = [];
  const existing = buildExistingMaps(ctx.existingSlabs);

  for (const table of tables) {
    const sheet = sheets.find((s) => s.sheetName === table.sheetName);
    const colorCol = colIndex(table.colorColumn);
    if (!sheet || colorCol === null) {
      warnings.push(`Skipped a table: unknown sheet "${table.sheetName}" or color column "${table.colorColumn}".`);
      continue;
    }
    const seriesCol = colIndex(table.seriesColumn);
    const codeCol = colIndex(table.codeColumn);
    const finishCol = colIndex(table.finishColumn);
    const statusCol = colIndex(table.statusColumn);
    const groups = (table.priceGroups || [])
      .map((g) => ({
        ...g,
        sfCol: colIndex(g.sfPriceColumn),
        slabCol: colIndex(g.slabPriceColumn),
        thickness: SLAB_THICKNESS_OPTIONS.includes(g.thickness) ? g.thickness : normalizeThicknessStrict(g.thickness) || "",
        size: orientSize(positiveOrNull(g.heightIn), positiveOrNull(g.widthIn)),
      }))
      .filter((g) => g.sfCol !== null || g.slabCol !== null);
    if (groups.length === 0) {
      warnings.push(`Skipped table on "${table.sheetName}": no price columns were identified.`);
      continue;
    }

    const start = Math.max(0, (table.firstRow || 1) - 1);
    const end = Math.min(sheet.grid.length - 1, table.lastRow ? table.lastRow - 1 : sheet.grid.length - 1);

    // Check every price group's size against its own prices (slab / SF).
    const profiles: SizeProfile[] = [];
    for (const g of groups) {
      if (g.size[0] && g.size[1]) addProfile(profiles, g.size[0], g.size[1], g.code?.trim() || null, g.thickness || null);
    }
    addProfilesFromNotes(profiles, ctx.notes);
    for (let r = Math.max(0, start - 40); r <= end; r++) {
      for (const c of sheet.grid[r] || []) if (typeof c === "string") addProfilesFromText(profiles, c);
    }
    for (const g of groups) {
      if (g.sfCol === null || g.slabCol === null) continue;
      const implied: number[] = [];
      for (let r = start; r <= end; r++) {
        const row = sheet.grid[r];
        if (!row || !cellText(row[colorCol] ?? null)) continue;
        const sf = cellPrice(row[g.sfCol] ?? null);
        const slab = cellPrice(row[g.slabCol] ?? null);
        if (sf && slab) implied.push(slab / sf);
      }
      const area = median(implied);
      if (area === null) continue;
      const [h, w] = g.size;
      const current = h && w ? (h * w) / 144 : null;
      if (current !== null && areasMatch(area, current, AREA_MATCH_TOLERANCE)) continue;

      const cols = `${g.sfPriceColumn}/${g.slabPriceColumn}`;
      const oldSize = h && w ? `${h} x ${w}` : "no size";
      const others = profiles.filter((p) => !(p.heightIn === h && p.widthIn === w && p.code === (g.code?.trim() || null)));
      const best = pickProfile(area, g.thickness || null, others);
      if (!best) {
        warnings.push(
          `Price columns ${cols} ("${g.label}"): prices work out to ${area.toFixed(2)} SF per slab, which doesn't match ${oldSize}. ` +
            `Check those rows (Issues filter: "Size doesn't match prices").`,
        );
        continue;
      }
      // The old code belonged to the wrong size if another group of that size uses it too.
      const oldCode = g.code?.trim() || null;
      const oldCodeShared =
        !!oldCode && groups.some((o) => o !== g && (o.code?.trim() || null) === oldCode && o.size[0] === h && o.size[1] === w);
      const newCode =
        best.code ?? codeForSize(best.heightIn, best.widthIn, g.thickness || null, profiles) ?? (oldCodeShared ? null : oldCode);
      warnings.push(
        `Price columns ${cols} ("${g.label}"): prices work out to ${area.toFixed(2)} SF per slab, which is ` +
          `${best.heightIn} x ${best.widthIn}, not ${oldSize} - used ${best.heightIn} x ${best.widthIn}` +
          `${newCode ? ` and code ${newCode}` : ""} for those slabs.`,
      );
      g.size = [best.heightIn, best.widthIn];
      g.code = newCode;
    }
    const seriesMap = new Map(
      (table.seriesValueMap || []).map((m) => [String(m.value).trim().toLowerCase(), String(m.series).trim()]),
    );
    const defaultFinish = SLAB_FINISH_OPTIONS.includes(table.defaultFinish) ? table.defaultFinish : "POLISHED";

    let lastSeriesValue: string | null = null;

    for (let r = start; r <= end; r++) {
      const row = sheet.grid[r];
      if (!row) continue;

      const seriesCell = seriesCol !== null ? cellText(row[seriesCol] ?? null) : null;
      if (seriesCell) lastSeriesValue = seriesCell;

      const rawColor = cellText(row[colorCol] ?? null);
      if (!rawColor) continue;
      const priced = groups
        .map((g) => ({
          g,
          sf: g.sfCol !== null ? cellPrice(row[g.sfCol] ?? null) : null,
          slab: g.slabCol !== null ? cellPrice(row[g.slabCol] ?? null) : null,
        }))
        .filter((p) => p.sf !== null || p.slab !== null);
      if (priced.length === 0) continue; // headers, notes, colors with no price

      const cleaned = cleanColor(rawColor);
      if (!cleaned) continue;
      const split = splitFinishFromColor(cleaned, existing.colors);
      let finish = split.finish;
      let finishFlag = false;
      if (finishCol !== null) {
        const raw = cellText(row[finishCol] ?? null);
        if (raw) {
          const norm = normalizeFinishStrict(raw);
          finish = norm.finish;
          finishFlag = !norm.recognized;
        }
      }
      if (!finish) {
        const known = existing.finishes.get(split.color.toLowerCase());
        finish = known && known.size === 1 ? Array.from(known)[0] : defaultFinish;
      }

      const seriesValue = lastSeriesValue;
      const rowSeries = seriesValue
        ? seriesMap.get(seriesValue.toLowerCase()) ?? `${table.seriesPrefix ?? ""}${seriesValue}`.trim()
        : null;
      const rowCode = codeCol !== null ? cellText(row[codeCol] ?? null) : null;
      const status = statusCol !== null ? normalizeStatus(cellText(row[statusCol] ?? null)) : "AVAILABLE";

      for (const { g, sf, slab } of priced) {
        const flags: SlabRowFlag[] = [];
        if (finishFlag) flags.push("finish-unrecognized");
        rows.push({
          id: newRowId(),
          series: g.series?.trim() || rowSeries,
          code: g.code?.trim() || rowCode,
          color: split.color,
          finish,
          heightIn: g.size[0],
          widthIn: g.size[1],
          thickness: g.thickness,
          sfPrice: sf,
          slabPrice: slab,
          status,
          source: `${sheet.sheetName} row ${r + 1}`,
          sourceFinish: split.finish ? cleaned : null,
          sourceThickness: null,
          flags,
          note: null,
        });
      }
    }
  }
  return { rows, warnings };
}

function describePlan(tables: PlanTable[]): string[] {
  return tables.map((t) => {
    const groups = t.priceGroups
      .map((g) => {
        const cols = [g.sfPriceColumn && `SF ${g.sfPriceColumn}`, g.slabPriceColumn && `slab ${g.slabPriceColumn}`]
          .filter(Boolean)
          .join(" / ");
        return `${g.label} (${cols}${g.code ? `, code ${g.code}` : ""}${g.series ? `, series ${g.series}` : ""})`;
      })
      .join("; ");
    return (
      `Read "${t.sheetName}" rows ${t.firstRow}-${t.lastRow ?? "end"}: color in column ${t.colorColumn}` +
      (t.seriesColumn ? `, series from column ${t.seriesColumn}${t.seriesPrefix ? ` as "${t.seriesPrefix}<value>"` : ""}` : "") +
      `. Price columns: ${groups}.`
    );
  });
}

async function extractWithLayoutPlan(
  client: Anthropic,
  sheets: SlabSheet[],
  ctx: ExtractContext,
): Promise<ExtractResult> {
  let budget = PLAN_MAX_PROMPT_CHARS;
  const sections: string[] = [];
  for (const sheet of sheets) {
    const first = firstNonEmptyRow(sheet.grid);
    const last = lastNonEmptyRow(sheet.grid);
    if (first < 0 || budget <= 0) continue;
    const shownLast = Math.min(last, first + PLAN_MAX_ROWS_PER_SHEET - 1);
    let text = renderRows(sheet.grid, first, shownLast);
    if (text.length > budget) text = text.slice(0, budget);
    budget -= text.length;
    sections.push(
      `### Sheet "${sheet.sheetName}" (rows ${first + 1}-${last + 1}${shownLast < last ? `, showing the first ${shownLast - first + 1}` : ""})\n${text}`,
    );
  }

  const system =
    sharedIntro(ctx) +
    `YOUR TASK: describe the spreadsheet's LAYOUT so the app can read every row itself. Do NOT copy prices. ` +
    `Each line below is "R<row>: <column letter>=<value> | ...". Empty cells are left out. Merged cells have been ` +
    `expanded, so a heading merged across several columns repeats in each of them, and a group label merged down ` +
    `a block of rows repeats on every row of the block.\n` +
    `Typical matrix layout: one color per row, and pairs of SF price / slab price columns under headings that give ` +
    `the size and thickness. Make one priceGroup per size x thickness column pair. Use the admin's notes for codes ` +
    `and series names (e.g. put a fixed code on each priceGroup, a seriesPrefix like "Group ", seriesValueMap for ` +
    `special group values, or a priceGroup.series override for groups that always belong to one series).`;

  const { input } = await streamToolCall(
    client,
    system,
    `${sections.join("\n\n")}\n\nCall emit_layout_plan.`,
    PLAN_TOOL,
    PLAN_MAX_OUTPUT_TOKENS,
  );

  const observations: string[] = Array.isArray(input.observations)
    ? input.observations.filter((o: unknown) => typeof o === "string" && o.trim())
    : [];
  const tables: PlanTable[] = Array.isArray(input.tables) ? input.tables : [];

  if (!input.tabular || tables.length === 0) {
    return {
      rows: [],
      warnings: [],
      observations: ["The layout isn't a regular grid - reading it row by row instead.", ...observations],
      priceCheck: "checked",
      fallback: true,
    };
  }

  const { rows, warnings } = applyLayoutPlan(sheets, tables, ctx);
  if (rows.length === 0) {
    return {
      rows: [],
      warnings,
      observations: ["The layout couldn't be mapped to any prices - reading it row by row instead.", ...observations],
      priceCheck: "checked",
      fallback: true,
    };
  }
  return {
    rows,
    warnings,
    observations: [...describePlan(tables), ...observations],
    priceCheck: "checked",
  };
}

/* ------------------------------------------------------------------ */
/* 2. Direct reading (PDFs, irregular spreadsheets)                    */
/* ------------------------------------------------------------------ */

const ROWS_TOOL = {
  name: "emit_slab_prices",
  description: "Report every slab price found in this part of the price list.",
  input_schema: {
    type: "object",
    properties: {
      columnGroups: {
        type: "array",
        description:
          "Each distinct size x thickness (x code) that prices are given for, e.g. the column pairs of a price matrix. " +
          "Define each once and reference it by id from items.",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "Short id like g1." },
            thickness: { type: "string", enum: [...SLAB_THICKNESS_OPTIONS, "UNKNOWN"] },
            heightIn: { type: ["number", "null"] },
            widthIn: { type: ["number", "null"] },
            code: { type: ["string", "null"], description: "Code shared by every slab in this group, if any." },
            series: { type: ["string", "null"], description: "Series forced for this group (overrides the item's series)." },
          },
          required: ["id", "thickness", "heightIn", "widthIn"],
        },
      },
      items: {
        type: "array",
        description: "One entry per color (and finish) with all of its prices.",
        items: {
          type: "object",
          properties: {
            color: { type: "string" },
            finish: { type: "string", enum: SLAB_FINISH_OPTIONS },
            finishAsPrinted: { type: ["string", "null"] },
            series: { type: ["string", "null"] },
            code: { type: ["string", "null"], description: "Per-color SKU, if any." },
            status: { type: "string", enum: SLAB_STATUS_OPTIONS },
            location: { type: "integer", description: "Page number (PDF) or row number (spreadsheet)." },
            confidence: { type: "string", enum: ["high", "low"] },
            note: { type: ["string", "null"] },
            prices: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  group: { type: "string" },
                  sf: { type: ["number", "null"], description: "Price per square foot exactly as printed." },
                  slab: { type: ["number", "null"], description: "Price per slab exactly as printed." },
                },
                required: ["group", "sf", "slab"],
              },
            },
          },
          required: ["color", "finish", "status", "location", "confidence", "prices"],
        },
      },
      observations: { type: "array", items: { type: "string" } },
    },
    required: ["columnGroups", "items", "observations"],
  },
};

const DIRECT_TASK =
  `YOUR TASK: read every slab price in the part of the list you're given. First define columnGroups (each ` +
  `size x thickness combination prices are given for - with its code/series if the admin's notes assign one ` +
  `per size), then list each color ONCE with all its prices referencing those groups. Copy prices exactly as ` +
  `printed. Set confidence "low" with a short note only when you had to guess. If this part has no slab prices ` +
  `(cover page, terms), return empty arrays and say so in observations.`;

type DirectResult = { rows: SlabTemplateRow[]; observations: string[]; truncated: boolean };

function collectNumbersFromText(text: string, into: Set<number>) {
  const matches = text.match(/\d[\d,]*(?:\.\d+)?/g) || [];
  for (const m of matches) {
    const value = parseFloat(m.replace(/,/g, ""));
    if (Number.isFinite(value)) into.add(Math.round(value * 100));
  }
}

function priceFound(price: number | null, numbers: Set<number>): boolean {
  if (price == null) return true;
  return numbers.has(Math.round(price * 100));
}

function directToRows(
  input: any,
  sourceFor: (location: number | null) => string,
  numbers: Set<number> | null,
  existing: ReturnType<typeof buildExistingMaps>,
  contextText: string | null,
  notes: string | null,
): SlabTemplateRow[] {
  const groups = new Map<string, any>();
  const profiles: SizeProfile[] = [];
  for (const g of Array.isArray(input.columnGroups) ? input.columnGroups : []) {
    if (g && typeof g.id === "string") {
      groups.set(g.id, g);
      const h = positiveOrNull(g.heightIn);
      const w = positiveOrNull(g.widthIn);
      if (h && w) addProfile(profiles, h, w, g.code?.toString().trim() || null, g.thickness || null);
    }
  }
  addProfilesFromNotes(profiles, notes);
  if (contextText) addProfilesFromText(profiles, contextText);
  const rows: SlabTemplateRow[] = [];
  for (const item of Array.isArray(input.items) ? input.items : []) {
    const cleaned = cleanColor(item?.color);
    if (!cleaned) continue;
    const split = splitFinishFromColor(cleaned, existing.colors);
    let finish: string =
      typeof item.finish === "string" && SLAB_FINISH_OPTIONS.includes(item.finish) ? item.finish : "";
    if (!finish || (finish === "POLISHED" && split.finish)) finish = split.finish || finish;
    if (!finish) finish = normalizeFinishStrict(item.finishAsPrinted).finish;

    for (const p of Array.isArray(item.prices) ? item.prices : []) {
      const g = groups.get(p?.group) || {};
      const sf = positiveOrNull(p?.sf);
      const slab = positiveOrNull(p?.slab);
      if (sf === null && slab === null) continue;
      let [heightIn, widthIn] = orientSize(positiveOrNull(g.heightIn), positiveOrNull(g.widthIn));
      let code: string | null = (g.code ?? item.code)?.toString().trim() || null;
      let note: string | null = item.note?.toString().trim() || null;
      const flags: SlabRowFlag[] = [];
      if (item.confidence === "low") flags.push("low-confidence");
      if (sf && slab) {
        const implied = slab / sf;
        const current = heightIn && widthIn ? (heightIn * widthIn) / 144 : null;
        if (current === null || !areasMatch(implied, current, AREA_MATCH_TOLERANCE)) {
          const best = pickProfile(implied, g.thickness || null, profiles);
          if (best) {
            note = `Size set from prices (${implied.toFixed(2)} SF per slab = ${best.heightIn} x ${best.widthIn})`;
            heightIn = best.heightIn;
            widthIn = best.widthIn;
            code = best.code ?? codeForSize(best.heightIn, best.widthIn, g.thickness || null, profiles) ?? (g.code ? null : code);
            if (!flags.includes("low-confidence")) flags.push("low-confidence");
          }
        }
      }
      if (finish === "OTHER" && item.finishAsPrinted) flags.push("finish-unrecognized");
      if (numbers && (!priceFound(sf, numbers) || !priceFound(slab, numbers))) flags.push("price-unverified");
      const location = Number.isInteger(item.location) ? item.location : null;
      rows.push({
        id: newRowId(),
        series: (g.series ?? item.series)?.toString().trim() || null,
        code,
        color: split.color,
        finish,
        heightIn,
        widthIn,
        thickness: SLAB_THICKNESS_OPTIONS.includes(g.thickness) ? g.thickness : "",
        sfPrice: sf,
        slabPrice: slab,
        status: normalizeStatus(item.status),
        source: sourceFor(location),
        sourceFinish: item.finishAsPrinted?.toString().trim() || null,
        sourceThickness: null,
        flags,
        note,
      });
    }
  }
  return rows;
}

async function directCall(
  client: Anthropic,
  ctx: ExtractContext,
  content: Anthropic.MessageParam["content"],
  sourceFor: (location: number | null) => string,
  numbers: Set<number> | null,
  contextText: string | null,
): Promise<DirectResult> {
  const { input, truncated } = await streamToolCall(
    client,
    sharedIntro(ctx) + DIRECT_TASK,
    content,
    ROWS_TOOL,
    MAX_OUTPUT_TOKENS,
  );
  const observations: string[] = Array.isArray(input.observations)
    ? input.observations.filter((o: unknown) => typeof o === "string" && o.trim())
    : [];
  return {
    rows: directToRows(input, sourceFor, numbers, buildExistingMaps(ctx.existingSlabs), contextText, ctx.notes),
    observations,
    truncated,
  };
}

/* ------------------------------ pdf text ----------------------------- */

// pdfjs-dist's Node ("legacy") build - loaded the same way as
// cabinetCatalogPdfRender.ts (see the comment there for why).
let pdfjsLibPromise: Promise<any> | null = null;
async function getPdfjsLib(): Promise<any> {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
      // pdf.worker.mjs ships no type declarations (TS7016 under strict).
      // @ts-ignore
      await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
      return pdfjsLib;
    })();
  }
  return pdfjsLibPromise;
}

/** Text layer of a PDF, or null for scanned/image-only PDFs or on any failure. */
async function extractPdfText(bytes: Uint8Array): Promise<string | null> {
  try {
    const pdfjsLib = await getPdfjsLib();
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: 0,
    }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((it: any) => (typeof it.str === "string" ? it.str : "")).join(" "));
    }
    await doc.destroy?.();
    const text = parts.join("\n");
    return /\d/.test(text) ? text : null;
  } catch (err) {
    console.error("slabsImportAi: PDF text extraction failed (price check skipped):", err);
    return null;
  }
}

async function buildPageSubset(doc: PDFDocument, startIndex: number, count: number): Promise<Uint8Array> {
  const subset = await PDFDocument.create();
  const pages = await subset.copyPages(
    doc,
    Array.from({ length: count }, (_, i) => startIndex + i),
  );
  for (const page of pages) subset.addPage(page);
  return subset.save();
}

async function extractPdfRange(
  client: Anthropic,
  doc: PDFDocument,
  startIndex: number, // 0-indexed page in the original file
  count: number,
  totalPages: number,
  ctx: ExtractContext,
  out: ExtractResult,
): Promise<void> {
  const bytes = await buildPageSubset(doc, startIndex, count);
  if (bytes.byteLength > MAX_CHUNK_BYTES && count > 1) {
    for (let i = 0; i < count; i++) await extractPdfRange(client, doc, startIndex + i, 1, totalPages, ctx, out);
    return;
  }

  const firstPage = startIndex + 1;
  const lastPage = startIndex + count;
  const text = await extractPdfText(bytes);
  let numbers: Set<number> | null = null;
  if (text) {
    numbers = new Set<number>();
    collectNumbersFromText(text, numbers);
  } else {
    out.priceCheck = "unavailable";
  }

  const prompt =
    `The attached PDF is ${count === 1 ? `page ${firstPage}` : `pages ${firstPage}-${lastPage}`} of a ` +
    `${totalPages}-page price list. For "location", give the page number WITHIN the attached document ` +
    `(1 = its first page).\n\nCall emit_slab_prices.`;

  const result = await directCall(
    client,
    ctx,
    [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: Buffer.from(bytes).toString("base64") },
      },
      { type: "text", text: prompt },
    ],
    (loc) => `Page ${startIndex + Math.min(Math.max(loc || 1, 1), count)}`,
    numbers,
    text,
  );

  if (result.truncated && count > 1) {
    for (let i = 0; i < count; i++) await extractPdfRange(client, doc, startIndex + i, 1, totalPages, ctx, out);
    return;
  }
  if (result.truncated) {
    out.warnings.push(
      `Page ${firstPage} has more prices than could be read in one pass - rows near the end of that page may be missing. Check it against the PDF.`,
    );
  }
  out.rows.push(...result.rows);
  for (const obs of result.observations) {
    out.observations.push(count === 1 ? `Page ${firstPage}: ${obs}` : `Pages ${firstPage}-${lastPage}: ${obs}`);
  }
}

async function extractSheetRange(
  client: Anthropic,
  sheet: SlabSheet,
  start: number,
  end: number,
  ctx: ExtractContext,
  out: ExtractResult,
): Promise<void> {
  const { grid, sheetName } = sheet;
  const headerEnd = Math.min(SHEET_HEADER_CONTEXT_ROWS - 1, start - 1);
  const precedingStart = Math.max(headerEnd + 1, start - SHEET_PRECEDING_CONTEXT_ROWS);

  const numbers = new Set<number>();
  for (let i = 0; i <= end && i < grid.length; i++) {
    if (i >= precedingStart || i <= headerEnd) {
      for (const c of grid[i]) {
        if (typeof c === "number") numbers.add(Math.round(c * 100));
        else if (typeof c === "string") collectNumbersFromText(c, numbers);
      }
    }
  }

  const headerBlock = start > 0 && headerEnd >= 0 ? renderRows(grid, 0, headerEnd) : "";
  const precedingBlock = start > 0 && precedingStart <= start - 1 ? renderRows(grid, precedingStart, start - 1) : "";

  const prompt =
    `Below is part of the spreadsheet sheet "${sheetName}". Each line is "R<row>: <column letter>=<value> | ..." ` +
    `(empty cells left out; merged cells expanded). For "location", give the row number where the color is.\n\n` +
    (headerBlock ? `TOP OF THE SHEET (context only - do NOT output prices from here):\n${headerBlock}\n\n` : "") +
    (precedingBlock
      ? `ROWS JUST BEFORE THIS PART (context only - column headings, sizes, current group; do NOT output prices from here):\n${precedingBlock}\n\n`
      : "") +
    `ROWS TO READ:\n${renderRows(grid, start, end)}\n\nCall emit_slab_prices for the ROWS TO READ only.`;

  const result = await directCall(
    client,
    ctx,
    prompt,
    (loc) => (loc ? `${sheetName} row ${loc}` : sheetName),
    numbers,
    prompt,
  );

  if (result.truncated && end - start + 1 > MIN_SPLIT_ROWS) {
    const mid = Math.floor((start + end) / 2);
    await extractSheetRange(client, sheet, start, mid, ctx, out);
    await extractSheetRange(client, sheet, mid + 1, end, ctx, out);
    return;
  }
  if (result.truncated) {
    out.warnings.push(
      `Rows ${start + 1}-${end + 1} of "${sheetName}" could not be read completely - check them against the file.`,
    );
  }
  out.rows.push(...result.rows);
  for (const obs of result.observations) out.observations.push(`"${sheetName}" rows ${start + 1}-${end + 1}: ${obs}`);
}

/* ------------------------------- entry ------------------------------- */

export async function extractSlabImportChunk(
  buffer: ArrayBuffer,
  fileName: string,
  chunkIndex: number,
  ctx: ExtractContext,
): Promise<ExtractResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Add it to your environment variables to use AI-assisted import.",
    );
  }

  const plan = await planSlabImport(buffer, fileName);
  if (plan.kind === "template") {
    throw new Error("This file is already in the GMD template - it doesn't need the AI.");
  }
  const chunk = [...plan.chunks, ...plan.fallbackChunks].find((c) => c.index === chunkIndex);
  if (!chunk) throw new Error(`Unknown chunk ${chunkIndex}`);

  const client = new Anthropic({ apiKey });
  const out: ExtractResult = { rows: [], warnings: [], observations: [], priceCheck: "checked" };

  if (chunk.kind === "sheet-plan") {
    return extractWithLayoutPlan(client, readSlabSheets(buffer, fileName), ctx);
  }
  if (chunk.kind === "pdf" && plan.kind === "pdf") {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    await extractPdfRange(client, doc, chunk.startPage - 1, chunk.pageCount, plan.totalPages, ctx, out);
  } else if (chunk.kind === "sheet") {
    const sheet = readSlabSheets(buffer, fileName).find((s) => s.sheetName === chunk.sheetName);
    if (!sheet) throw new Error(`Sheet "${chunk.sheetName}" not found`);
    await extractSheetRange(client, sheet, chunk.startRow, chunk.endRow, ctx, out);
  }
  return out;
}

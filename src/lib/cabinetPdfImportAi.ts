/**
 * Reads a cabinet vendor's PDF price list into a table, a few pages at a
 * time. The output of every chunk is a header row + one row per product line;
 * cabinetPdfGrid.ts merges the chunks into a grid that then goes through the
 * normal cabinet import (parse plan -> review -> apply).
 *
 * Every price the AI writes down is checked against the numbers actually in
 * the PDF's text layer, so a mis-read digit is flagged for the admin instead
 * of silently imported. Nothing is saved here.
 */

import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import type { PdfColor } from "./cabinetPdfGrid";

const MODEL = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 20000;
const PAGES_PER_CHUNK = 2;
const MAX_PDF_PAGES = 120;
const MAX_CHUNK_BYTES = 16 * 1024 * 1024;

export type CabinetPdfChunk = {
  index: number;
  startPage: number;
  pageCount: number;
  label: string;
};

export type CabinetPdfPlan = {
  totalPages: number;
  chunks: CabinetPdfChunk[];
  warnings: string[];
};

export type CabinetPdfExtractContext = {
  vendorName: string;
  notes: string | null;
  // Column names found on an earlier chunk - a hint for pages that don't
  // reprint the column headings.
  knownColumns: string[] | null;
};

export type CabinetPdfExtractResult = {
  columns: string[];
  rows: string[][];
  // Color/finish swatches found on these pages (see TABLE_TOOL.colors).
  colors: PdfColor[];
  observations: string[];
  warnings: string[];
  priceCheck: "checked" | "unavailable";
};

export async function planCabinetPdf(buffer: ArrayBuffer): Promise<CabinetPdfPlan> {
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
  const chunks: CabinetPdfChunk[] = [];
  for (let start = 1; start <= pages; start += PAGES_PER_CHUNK) {
    const count = Math.min(PAGES_PER_CHUNK, pages - start + 1);
    chunks.push({
      index: chunks.length,
      startPage: start,
      pageCount: count,
      label: count === 1 ? `page ${start}` : `pages ${start}-${start + count - 1}`,
    });
  }
  return { totalPages, chunks, warnings };
}

/* ------------------------------ pdf text ----------------------------- */

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
    console.error("cabinetPdfImportAi: PDF text extraction failed (price check skipped):", err);
    return null;
  }
}

function collectNumbers(text: string, into: Set<number>) {
  const matches = text.match(/\d[\d,]*(?:\.\d+)?/g) || [];
  for (const m of matches) {
    const value = parseFloat(m.replace(/,/g, ""));
    if (Number.isFinite(value)) into.add(Math.round(value * 100));
  }
}

/* -------------------------------- AI -------------------------------- */

const TABLE_TOOL = {
  name: "emit_price_table",
  description: "Report the product table found on these PDF pages.",
  input_schema: {
    type: "object" as const,
    properties: {
      columns: {
        type: "array",
        items: { type: "string" },
        description:
          "Column names in order. First three are exactly 'Category', 'Code', 'Description'. " +
          "Then 'Size' only if sizes have their own column, then one column per price column, " +
          "named as printed in the column heading.",
      },
      rows: {
        type: "array",
        description:
          "One entry per product line, each an array of strings with exactly as many cells as " +
          "'columns', in the same order. Copy text and prices exactly as printed.",
        items: { type: "array", items: { type: "string" } },
      },
      colors: {
        type: "array",
        description:
          "Color / finish swatches shown on these pages together with the price LEVEL they are " +
          "sold under (usually printed as a banner such as 'LEVEL 2 : VENICE ...' above a group " +
          "of door photos, each captioned with a color name and a short code). One entry per " +
          "swatch. Leave empty on pages that only hold price tables.",
        items: {
          type: "object",
          properties: {
            level: {
              type: ["integer", "null"],
              description:
                "The level number from the nearest LEVEL banner above the swatch. null when no " +
                "banner is visible on these pages (the swatch continues a group from an earlier page).",
            },
            name: { type: "string", description: "Color name exactly as captioned, e.g. 'White Oak'." },
            code: { type: "string", description: "Short code captioned with it, e.g. 'VTW'. Empty if none." },
          },
          required: ["level", "name", "code"],
        },
      },
      observations: {
        type: "array",
        items: { type: "string" },
        description:
          "Short notes for the admin: assumptions you made, anything ambiguous or unreadable, " +
          "pages with no product table, headings that bundle several color codes.",
      },
    },
    required: ["columns", "rows"],
  },
};

function systemPrompt(ctx: CabinetPdfExtractContext): string {
  const notes = ctx.notes?.trim()
    ? `NOTES FROM THE ADMIN - follow these exactly; they override every default below:\n${ctx.notes.trim()}\n\n`
    : "";
  return (
    `You read cabinet vendor price lists (PDF) and copy the product table into a clean grid. ` +
    `The vendor is "${ctx.vendorName}".\n\n` +
    notes +
    `RULES\n` +
    `- One output row per product line: a cabinet or accessory that has an item code and at least one price. ` +
    `Skip page headers/footers, legends, terms and conditions, photo captions, subtotal rows and blank rows.\n` +
    `- Columns: 'Category', 'Code', 'Description', then 'Size' only when sizes/dimensions have their own ` +
    `column, then one column per price column named exactly as the heading is printed (color/finish/level ` +
    `names or codes). If one heading bundles several codes that share a price (e.g. "CS, US"), keep it as printed.\n` +
    `- LEVELS AND COLORS: many lists print their colors/finishes on the first pages (door photos grouped under ` +
    `"LEVEL 1", "LEVEL 2" ... banners) and only one price per LEVEL on the pages with the tables. When a price ` +
    `column is headed by a level, name it exactly "Level 1", "Level 2", ... (just the number - drop sub-headings ` +
    `like "Full Cabinet"; only when one level has several different sub-columns, use "Level 1 - <sub-heading>"). ` +
    `NEVER put color names into price column names yourself, even if the admin notes ask for columns like ` +
    `"Lv1 - White WGW": the colors are usually not on the price pages, and the app combines the levels with the ` +
    `colors you report in 'colors' AFTER all pages are read. Follow the rest of the admin notes (what to ignore, ` +
    `etc.) as usual.\n` +
    `- On pages with color swatches, fill 'colors' (level, name, code for every swatch) - do not invent products ` +
    `or prices from them. If the admin notes say to ignore some part of the list (e.g. samples, assembly fees, ` +
    `accessories), leave those rows out.\n` +
    `- Category is the section heading in effect for the row (e.g. "BASE CABINETS"); repeat it on every row of ` +
    `that section. If the page starts in the middle of a section whose heading is not on the page, leave it empty.\n` +
    `- Copy codes, descriptions and prices EXACTLY as printed. Never calculate, round, convert, fix or guess a ` +
    `price. A price column with no price for that row is an empty string.\n` +
    `- If several size variants of one item each have their own code, write one row per code.\n` +
    `- Every row must have exactly as many cells as 'columns'.\n` +
    `- Put anything the admin should know in 'observations'.\n` +
    (ctx.knownColumns && ctx.knownColumns.length > 0
      ? `\nEarlier pages of this price list used these columns: ${ctx.knownColumns.join(" | ")}. ` +
        `If these pages show the same table without reprinting the column headings, use these column names. ` +
        `If they print their own headings, use those.\n`
      : "")
  );
}

async function streamTable(
  client: Anthropic,
  ctx: CabinetPdfExtractContext,
  content: Anthropic.MessageParam["content"],
): Promise<{ input: any; truncated: boolean }> {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [{ type: "text", text: systemPrompt(ctx), cache_control: { type: "ephemeral" } }],
    tools: [TABLE_TOOL as any],
    tool_choice: { type: "tool", name: TABLE_TOOL.name },
    messages: [{ role: "user", content }],
  });
  const message = await stream.finalMessage();
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  return { input: toolUse?.input || {}, truncated: message.stop_reason === "max_tokens" };
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

const NON_PRICE_COLUMNS = new Set(["category", "code", "description", "size"]);

function looksLikePrice(cell: string): number | null {
  const t = cell.trim();
  if (!/^\$?\s*\d[\d,]*(?:\.\d+)?$/.test(t)) return null;
  const value = parseFloat(t.replace(/[$,\s]/g, ""));
  return Number.isFinite(value) ? value : null;
}

function cleanTable(input: any): { columns: string[]; rows: string[][] } {
  const columns: string[] = Array.isArray(input?.columns)
    ? input.columns.map((c: unknown) => String(c ?? "").trim()).filter(Boolean)
    : [];
  const rows: string[][] = [];
  if (Array.isArray(input?.rows)) {
    for (const raw of input.rows) {
      if (!Array.isArray(raw)) continue;
      const cells = columns.map((_, i) => String(raw[i] ?? "").trim());
      if (cells.every((c) => !c)) continue;
      rows.push(cells);
    }
  }
  return { columns, rows };
}

async function extractRange(
  client: Anthropic,
  doc: PDFDocument,
  startIndex: number,
  count: number,
  totalPages: number,
  ctx: CabinetPdfExtractContext,
  out: {
    tables: { columns: string[]; rows: string[][] }[];
    colors: PdfColor[];
    observations: string[];
    warnings: string[];
    priceCheck: "checked" | "unavailable";
  },
): Promise<void> {
  const bytes = await buildPageSubset(doc, startIndex, count);
  if (bytes.byteLength > MAX_CHUNK_BYTES && count > 1) {
    for (let i = 0; i < count; i++) await extractRange(client, doc, startIndex + i, 1, totalPages, ctx, out);
    return;
  }
  const firstPage = startIndex + 1;
  const lastPage = startIndex + count;
  const pageLabel = count === 1 ? `Page ${firstPage}` : `Pages ${firstPage}-${lastPage}`;

  const text = await extractPdfText(bytes);
  let numbers: Set<number> | null = null;
  if (text) {
    numbers = new Set<number>();
    collectNumbers(text, numbers);
  } else {
    out.priceCheck = "unavailable";
  }

  const prompt =
    `The attached PDF is ${count === 1 ? `page ${firstPage}` : `pages ${firstPage}-${lastPage}`} of a ` +
    `${totalPages}-page price list. Call emit_price_table.`;
  const { input, truncated } = await streamTable(client, ctx, [
    {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: Buffer.from(bytes).toString("base64") },
    },
    { type: "text", text: prompt },
  ]);

  if (truncated && count > 1) {
    for (let i = 0; i < count; i++) await extractRange(client, doc, startIndex + i, 1, totalPages, ctx, out);
    return;
  }
  if (truncated) {
    out.warnings.push(
      `${pageLabel} has more rows than could be read in one pass - rows near the end of that page may be missing. Check it against the PDF.`,
    );
  }

  const table = cleanTable(input);
  if (numbers && table.columns.length > 0) {
    const codeIdx = table.columns.findIndex((c) => c.toLowerCase() === "code");
    const unverified: string[] = [];
    for (const row of table.rows) {
      table.columns.forEach((name, i) => {
        if (NON_PRICE_COLUMNS.has(name.toLowerCase())) return;
        const price = looksLikePrice(row[i]);
        if (price !== null && !numbers!.has(Math.round(price * 100))) {
          unverified.push(`${codeIdx >= 0 ? row[codeIdx] : "row"} (${name}: ${row[i]})`);
        }
      });
    }
    if (unverified.length > 0) {
      out.warnings.push(
        `${pageLabel}: ${unverified.length} price${unverified.length === 1 ? "" : "s"} could not be found in the PDF text and may be mis-read - check ${unverified
          .slice(0, 6)
          .join(", ")}${unverified.length > 6 ? ", ..." : ""} against the PDF.`,
      );
    }
  }
  out.tables.push(table);
  if (Array.isArray(input?.colors)) {
    for (const c of input.colors) {
      const name = typeof c?.name === "string" ? c.name.trim() : "";
      const code = typeof c?.code === "string" ? c.code.trim() : "";
      if (!name && !code) continue;
      const level = Number.isInteger(c?.level) && c.level > 0 ? (c.level as number) : null;
      out.colors.push({ level, name, code });
    }
  }
  const observations: string[] = Array.isArray(input?.observations)
    ? input.observations.filter((o: unknown) => typeof o === "string" && o.trim())
    : [];
  for (const obs of observations) out.observations.push(`${pageLabel}: ${obs}`);
}

export async function extractCabinetPdfChunk(
  buffer: ArrayBuffer,
  chunkIndex: number,
  ctx: CabinetPdfExtractContext,
): Promise<CabinetPdfExtractResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Add it to your environment variables to use AI-assisted import.",
    );
  }
  const plan = await planCabinetPdf(buffer);
  const chunk = plan.chunks.find((c) => c.index === chunkIndex);
  if (!chunk) throw new Error(`Unknown chunk ${chunkIndex}`);

  const client = new Anthropic({ apiKey });
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const out = {
    tables: [] as { columns: string[]; rows: string[][] }[],
    colors: [] as PdfColor[],
    observations: [] as string[],
    warnings: [] as string[],
    priceCheck: "checked" as "checked" | "unavailable",
  };
  await extractRange(client, doc, chunk.startPage - 1, chunk.pageCount, plan.totalPages, ctx, out);

  // A chunk that was split into single pages can return several tables -
  // fold them into one with a shared column list.
  const columns: string[] = [];
  for (const t of out.tables) for (const c of t.columns) if (!columns.includes(c)) columns.push(c);
  const rows: string[][] = [];
  for (const t of out.tables) {
    for (const row of t.rows) {
      const cells: string[] = new Array(columns.length).fill("");
      t.columns.forEach((name, i) => {
        cells[columns.indexOf(name)] = row[i];
      });
      rows.push(cells);
    }
  }
  return {
    columns,
    rows,
    colors: out.colors,
    observations: out.observations,
    warnings: out.warnings,
    priceCheck: out.priceCheck,
  };
}

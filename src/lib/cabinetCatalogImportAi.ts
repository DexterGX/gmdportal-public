/**
 * AI-assisted structural parsing for cabinet vendor price lists.
 *
 * This module's ONLY job is to look at a bounded sample of a vendor's
 * spreadsheet and infer a CabinetImportParsePlan - which column is the
 * item code, which are price-tier columns and what each tier is called,
 * and how category/section info is encoded. It never sees or reports on
 * the full file, and its output is never treated as the data itself:
 * cabinetCatalogImport.ts's applyParsePlan() re-reads the actual cells
 * deterministically once a plan (AI-produced or admin-edited) is settled.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  CABINET_SUMMARY_BUCKETS,
  gridToPromptText,
  type CabinetImportParsePlan,
  type CabinetSummaryBucket,
  type RawSheet,
} from "./cabinetCatalogImport";

const MODEL = "claude-sonnet-5";
const MAX_ROWS_PER_SHEET = 70;

const PARSE_PLAN_TOOL = {
  name: "emit_parse_plan",
  description:
    "Report the structural layout of the vendor price list so it can be parsed row by row.",
  input_schema: {
    type: "object" as const,
    properties: {
      sheetName: {
        type: "string",
        description: "Exact name of the sheet that contains the actual price list data.",
      },
      dataStartRow: {
        type: "integer",
        description: "0-indexed row number where item data rows begin (after all header rows).",
      },
      codeCol: { type: "integer", description: "0-indexed column holding the item code/SKU." },
      descriptionCol: {
        type: "integer",
        description: "0-indexed column holding the item description/name.",
      },
      priceColumns: {
        type: "array",
        description: "Every column that holds a price for a price tier/level/color.",
        items: {
          type: "object",
          properties: {
            col: { type: "integer" },
            tierName: {
              type: "string",
              description:
                "A short human-readable name for this price tier/level/color, derived from its header text.",
            },
          },
          required: ["col", "tierName"],
        },
      },
      categoryMode: {
        type: "string",
        enum: ["column", "sectionRow", "none"],
        description:
          "'column' if category is a literal value in its own column on every data row. " +
          "'sectionRow' if category comes from header rows that interrupt the data (e.g. a row " +
          "reading 'BASE CABINETS' with no code/price, applying to every row until the next one). " +
          "'none' if there is no discernible category information.",
      },
      categoryColumn: {
        type: ["integer", "null"],
        description: "0-indexed column with the category value, only when categoryMode is 'column'.",
      },
      sectionDetectColumn: {
        type: ["integer", "null"],
        description:
          "0-indexed column where section-header row text appears, only when categoryMode is 'sectionRow'.",
      },
      categoryBucketHints: {
        type: "array",
        description:
          "Substring->bucket rules mapping category text you observed to one of " +
          CABINET_SUMMARY_BUCKETS.join("/") +
          ". STANDARD = ordinary single cabinets, DOUBLE = double-door/double-drawer/pantry-style " +
          "cabinets, CUSTOM = customized/special-order items, MISC = accessories, panels, molding, " +
          "hardware, anything not a cabinet box. Add one hint per distinct category you actually " +
          "saw in the file rather than leaving most to fall through to defaultBucket - first match wins.",
        items: {
          type: "object",
          properties: {
            categoryContains: { type: "string" },
            bucket: { type: "string", enum: CABINET_SUMMARY_BUCKETS },
          },
          required: ["categoryContains", "bucket"],
        },
      },
      defaultBucket: {
        type: "string",
        enum: CABINET_SUMMARY_BUCKETS,
        description: "Bucket to use when no category hint matches (or there is no category).",
      },
    },
    required: [
      "sheetName",
      "dataStartRow",
      "codeCol",
      "descriptionCol",
      "priceColumns",
      "categoryMode",
      "categoryColumn",
      "sectionDetectColumn",
      "categoryBucketHints",
      "defaultBucket",
    ],
  },
};

function buildPrompt(sheets: RawSheet[], vendorName: string): string {
  const sections = sheets.map((sheet) => {
    const preview = gridToPromptText(sheet.grid, MAX_ROWS_PER_SHEET);
    return `### Sheet: "${sheet.sheetName}"\n${preview}`;
  });

  return (
    `This is a cabinet price list from vendor "${vendorName}", exported from a spreadsheet. ` +
    `Each row below is shown as "<row index>: <cell> | <cell> | ...". Column indexes are ` +
    `0-based and count from the left. Blank cells are empty between the pipes.\n\n` +
    `The file may have multiple sheets and only one may actually be the price list ` +
    `(the others could be legends, notes, or something unrelated) - pick the right one. ` +
    `Item rows have a code and a description together with at least one price in a price-tier ` +
    `column. Some vendors mark category with its own column on every row; others interrupt the ` +
    `item rows with section-header rows (e.g. "BASE CABINETS", "WALL CABINETS") that apply to ` +
    `every item below them until the next one. Figure out which applies here, if either does.\n\n` +
    `IMPORTANT about section-header rows: a merged section-header cell often flattens into the ` +
    `SAME column you'd otherwise pick as the code or description column - don't assume it needs ` +
    `its own separate column. A row is a section header if it has NO price in any tier column ` +
    `and does NOT look like a real item (a real item row almost always has both a code and a ` +
    `description present together, even one with no price). Set sectionDetectColumn to whichever ` +
    `column that header text actually appears in, even if that's the same as codeCol.\n\n` +
    `A price-tier column's header sometimes bundles several color/finish codes that share one ` +
    `price into a single cell (e.g. "CS, US" or "SM/PE/CT/NT") - report that header text exactly ` +
    `as it reads, comma/slash and all; the app splits it into separate tiers automatically, so ` +
    `don't try to pick just one code out of it.\n\n` +
    `For categoryBucketHints, this shop's own rule of thumb (use it as a guide, adapt to the ` +
    `actual category words you see, and it's fine to add more hints than these): pantry cabinets ` +
    `-> DOUBLE, crown molding/trim -> MISC, typical single/double-door base or wall cabinets -> ` +
    `STANDARD, drawer-bank cabinets -> DOUBLE, anything explicitly marked custom or special-order ` +
    `-> CUSTOM, hardware/accessories/panels/fillers -> MISC. Try to give every distinct category ` +
    `you see a real hint rather than leaving most of them to fall through to defaultBucket.\n\n` +
    sections.join("\n\n") +
    `\n\nCall emit_parse_plan with your best-effort structural reading of this file.`
  );
}

function isCabinetSummaryBucket(value: unknown): value is CabinetSummaryBucket {
  return (
    typeof value === "string" &&
    (CABINET_SUMMARY_BUCKETS as string[]).includes(value)
  );
}

function validatePlan(raw: any, sheetNames: string[]): CabinetImportParsePlan {
  if (!raw || typeof raw !== "object") {
    throw new Error("AI did not return a parse plan.");
  }
  if (!sheetNames.includes(raw.sheetName)) {
    throw new Error(`AI picked an unknown sheet: "${raw.sheetName}".`);
  }
  if (!Number.isInteger(raw.dataStartRow) || raw.dataStartRow < 0) {
    throw new Error("AI returned an invalid dataStartRow.");
  }
  if (!Number.isInteger(raw.codeCol) || !Number.isInteger(raw.descriptionCol)) {
    throw new Error("AI returned invalid code/description columns.");
  }
  if (!Array.isArray(raw.priceColumns) || raw.priceColumns.length === 0) {
    throw new Error("AI did not identify any price-tier columns.");
  }
  for (const pc of raw.priceColumns) {
    if (!Number.isInteger(pc?.col) || typeof pc?.tierName !== "string" || !pc.tierName.trim()) {
      throw new Error("AI returned an invalid price column entry.");
    }
  }
  if (!["column", "sectionRow", "none"].includes(raw.categoryMode)) {
    throw new Error("AI returned an invalid categoryMode.");
  }
  if (!isCabinetSummaryBucket(raw.defaultBucket)) {
    throw new Error("AI returned an invalid defaultBucket.");
  }
  const hints = Array.isArray(raw.categoryBucketHints) ? raw.categoryBucketHints : [];
  for (const hint of hints) {
    if (typeof hint?.categoryContains !== "string" || !isCabinetSummaryBucket(hint?.bucket)) {
      throw new Error("AI returned an invalid categoryBucketHints entry.");
    }
  }

  return {
    sheetName: raw.sheetName,
    dataStartRow: raw.dataStartRow,
    codeCol: raw.codeCol,
    descriptionCol: raw.descriptionCol,
    priceColumns: raw.priceColumns.map((pc: any) => ({ col: pc.col, tierName: String(pc.tierName).trim() })),
    categoryMode: raw.categoryMode,
    categoryColumn: Number.isInteger(raw.categoryColumn) ? raw.categoryColumn : null,
    sectionDetectColumn: Number.isInteger(raw.sectionDetectColumn) ? raw.sectionDetectColumn : null,
    categoryBucketHints: hints.map((h: any) => ({
      categoryContains: String(h.categoryContains).trim(),
      bucket: h.bucket as CabinetSummaryBucket,
    })),
    defaultBucket: raw.defaultBucket,
  };
}

export async function inferCabinetImportParsePlan(input: {
  sheets: RawSheet[];
  vendorName: string;
}): Promise<CabinetImportParsePlan> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Add it to your environment variables to use AI-assisted import.",
    );
  }

  const client = new Anthropic({ apiKey });
  const sheetNames = input.sheets.map((s) => s.sheetName);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [PARSE_PLAN_TOOL],
    tool_choice: { type: "tool", name: PARSE_PLAN_TOOL.name },
    messages: [
      {
        role: "user",
        content: buildPrompt(input.sheets, input.vendorName),
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("AI did not return a structured parse plan.");
  }

  return validatePlan(toolUse.input, sheetNames);
}

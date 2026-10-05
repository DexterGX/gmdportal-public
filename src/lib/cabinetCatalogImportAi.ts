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
  installationItemOptionKey,
  type CabinetImportParsePlan,
  type CabinetInstallationItemOption,
  type CabinetSummaryBucket,
  type RawSheet,
} from "./cabinetCatalogImport";

const MODEL = "claude-sonnet-5";
const MAX_ROWS_PER_SHEET = 70;

function buildParsePlanTool(installationItemKeys: string[]) {
  const properties: Record<string, any> = {
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
      sizeCol: {
        type: ["integer", "null"],
        description:
          "0-indexed column holding the cabinet's dimensions (e.g. '9\" X 34 1/2\" X 24\"'), " +
          "ONLY when that appears in its own separate column rather than already being part of " +
          "the description text. null if the description already includes the size, or there is " +
          "no separate size column at all - do not duplicate it.",
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
          ". STANDARD = ordinary cabinets, including multi-drawer base cabinets (a 3-drawer base " +
          "is still just a standard cabinet, NOT a \"double\" one - drawer count/door count don't " +
          "drive this bucket). DOUBLE = tall pantry and closet-style cabinets specifically - the " +
          "name refers to their size/type, not to having two doors or two drawers. CUSTOM = " +
          "customized/special-order items. MISC = accessories, panels, molding, hardware, anything " +
          "not a cabinet box. Add one hint per distinct category you actually saw in the file " +
          "rather than leaving most to fall through to defaultBucket - first match wins.",
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
  };

  const required = [
    "sheetName",
    "dataStartRow",
    "codeCol",
    "descriptionCol",
    "sizeCol",
    "priceColumns",
    "categoryMode",
    "categoryColumn",
    "sectionDetectColumn",
    "categoryBucketHints",
    "defaultBucket",
  ];

  // Only ask for installation-item hints when GMD actually has Installers
  // Price Table rows configured yet - a fresh install with none simply
  // gets no installationItemHints back (resolveInstallationItem then
  // leaves every item unassigned, same as "no hint matched").
  if (installationItemKeys.length > 0) {
    properties.installationItemHints = {
      type: "array",
      description:
        "Substring rules mapping to one of GMD's real Installers Price Table rows (listed " +
        "below in the prompt, each by its exact key). Despite the field name, categoryContains " +
        "is checked against each row's category text AND its own individual description " +
        "together - so if one category groups several genuinely different item types (e.g. a " +
        "\"PANELS AND DOORS\" category containing both real panels and dummy doors, or a " +
        "\"FILLERS\" category containing both plain and fluted fillers), write a separate hint " +
        "per item type using a word that appears in THAT item's own description (e.g. \"panel\" " +
        "for the panels, \"dummy\" for the dummy doors, \"fluted\" for the fluted filler), not " +
        "just one broad hint for the shared category label - a broad hint like \"filler\" or " +
        "\"molding\" alone would otherwise catch rows that really belong to a more specific hint. " +
        "When more than one hint matches the same row, the app keeps whichever hint text is " +
        "LONGEST/most specific, not whichever was written first, so it's safe (and encouraged) " +
        "to write both a general hint and more specific overrides. This mapping always takes " +
        "priority over any automatic bucket default (see installationItemExclusions) - a hint " +
        "you write here wins even for a row whose bucket already has a default item. It is " +
        "fine, and expected, to leave some rows unmapped (simply omit a hint) if nothing in the " +
        "list is really a good match - do not guess just to cover every row, and use " +
        "confidence \"low\" (see that field) rather than omitting a hint when a match is only " +
        "plausible, not certain.",
      items: {
        type: "object",
        properties: {
          categoryContains: { type: "string" },
          installationItemKey: { type: "string", enum: installationItemKeys },
          confidence: {
            type: "string",
            enum: ["high", "low"],
            description:
              "\"high\" when you're confident this row really is the item described. \"low\" " +
              "when it's a reasonable best guess but you're not sure - e.g. the description is " +
              "ambiguous, or it could plausibly belong to a couple of the listed items. Still " +
              "write the hint rather than omitting it - a \"low\" confidence match gets flagged " +
              "for the admin to double-check in the review screen, instead of either being " +
              "silently trusted (if you'd marked it high) or silently dropped (if you'd omitted " +
              "it). Omit the hint entirely only when there truly is no plausible match at all.",
          },
        },
        required: ["categoryContains", "installationItemKey", "confidence"],
      },
    };
    required.push("installationItemHints");

    properties.installationItemExclusions = {
      type: "array",
      description:
        "Text patterns (checked the same way as installationItemHints, against category+" +
        "description together) identifying rows that are NOT genuine full cabinets even though " +
        "their Cabinets Summary bucket is Standard or Double - small decorative or accessory " +
        "parts such as corbels/corbals, rosettes, wood blocks, onlays, valances, knee drawers, " +
        "or wine racks that GMD still counts as Standard/Double for the summary count, but that " +
        "should NOT automatically be priced as a full \"Standard Cabinet\"/\"Double Cabinet\" " +
        "installation. A row matching one of these patterns is excluded from that automatic " +
        "default - it only gets an installation item if installationItemHints also has a " +
        "specific match for it (e.g. map valance-style rows to a \"Valance\" item if one exists " +
        "in the list above), and is otherwise left unassigned rather than guessed. Only flag " +
        "genuinely small/decorative parts this way - do not flag ordinary base, wall, tall, " +
        "vanity, corner, or sink-base cabinets just because they come in many sizes or have " +
        "drawers; those ARE real cabinets and should keep the bucket default.",
      items: {
        type: "object",
        properties: {
          textContains: { type: "string" },
        },
        required: ["textContains"],
      },
    };
    required.push("installationItemExclusions");
  }

  return {
    name: "emit_parse_plan",
    description:
      "Report the structural layout of the vendor price list so it can be parsed row by row.",
    input_schema: {
      type: "object" as const,
      properties,
      required,
    },
  };
}

function buildPrompt(
  sheets: RawSheet[],
  vendorName: string,
  installationItems: CabinetInstallationItemOption[],
  catalogPdfAttached: boolean,
): string {
  const sections = sheets.map((sheet) => {
    const preview = gridToPromptText(sheet.grid, MAX_ROWS_PER_SHEET);
    return `### Sheet: "${sheet.sheetName}"\n${preview}`;
  });

  const installationItemsSection =
    installationItems.length > 0
      ? `GMD's real Installers Price Table currently has these rows (ordinary cabinet SKUs are ` +
        `handled automatically elsewhere and are deliberately NOT in this list - these are only ` +
        `the accessory/add-on style rows, e.g. crown molding, panels, fillers, appliance cutouts, ` +
        `dummy doors, valance) - for installationItemHints, map each row you identified to the ` +
        `single closest-matching row's key using a word from that specific row's OWN ` +
        `description, not just its category (a shared category can cover several distinct item ` +
        `types - see the field description above for why that matters) - do not invent new ` +
        `keys, and it's fine to leave a row unmapped rather than guess:\n` +
        installationItems
          .map((it) => `- key "${installationItemOptionKey(it)}": ${it.description}`)
          .join("\n") +
        `\n\nSeparately, watch for catalog rows that are small decorative or accessory parts - ` +
        `corbels/corbals, rosettes, wood blocks, onlays, knee drawers, wine racks, and similar - ` +
        `which GMD's category rules may still bucket as Standard or Double for the Cabinets ` +
        `Summary count even though they are not real cabinets. List patterns matching those ` +
        `rows in installationItemExclusions so they don't wrongly inherit the automatic ` +
        `"Standard Cabinet"/"Double Cabinet" default - they should end up mapped by a specific ` +
        `installationItemHints entry if a genuinely matching row exists above (e.g. a "valance" ` +
        `hint for valance-style SKUs), or left unassigned if nothing really fits.\n\n`
      : "";

  const catalogPdfSection = catalogPdfAttached
    ? `Also attached is this vendor's own product catalog (PDF), with photos/illustrations of ` +
      `its cabinets grouped by type. It is NOT a source of prices or codes - only the ` +
      `spreadsheet rows above are real data. Use the catalog purely as visual context: cross-` +
      `reference its codes against the spreadsheet rows to judge whether a row is a genuine ` +
      `full cabinet or a small decorative/accessory part (see installationItemExclusions), and ` +
      `to sanity-check installationItemHints - e.g. a category whose catalog photo clearly ` +
      `shows a corbel, valance, or similar small part rather than a cabinet box is a strong ` +
      `signal for installationItemExclusions even if its summary bucket says Standard/Double.\n\n`
    : "";

  return (
    catalogPdfSection +
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
    `IMPORTANT about the very first block of items: it's common for the first category in the ` +
    `whole list (e.g. "BASE CABINETS") to be its own short label row sitting directly above the ` +
    `first item row, with nothing else between them. If you set dataStartRow to the first item ` +
    `row itself, that leading label gets skipped entirely and every item in that first block ends ` +
    `up with no category at all. Look one row above the first item row - if it's a short standalone ` +
    `label rather than another column-header row, set dataStartRow to that label row instead so it ` +
    `gets picked up as a real section header, not silently dropped.\n\n` +
    `IMPORTANT about repeated header rows: some vendor sheets reprint the same column-header row ` +
    `every so many rows (e.g. once per printed page), with the same code/description/tier-name ` +
    `labels appearing again mid-file. You don't need to work around these yourself - the app ` +
    `already recognizes and skips a row that repeats the original header text, or that has ` +
    `non-numeric text sitting in the price-tier columns, so it won't get treated as a real item ` +
    `or overwrite the current category. Just pick codeCol/descriptionCol/priceColumns/` +
    `sectionDetectColumn as if the file were clean throughout.\n\n` +
    `IMPORTANT about dimensions: some sheets list a cabinet's size (width/height/depth, e.g. ` +
    `'9" X 34 1/2" X 24"') in its own separate column instead of folding it into the description ` +
    `text. When that's the case here, set sizeCol to that column so the app appends it onto the ` +
    `description - otherwise that size information would be silently lost. If the description ` +
    `already reads like it includes the size, or there's no distinct size column at all, leave ` +
    `sizeCol null rather than duplicating it.\n\n` +
    `A price-tier column's header sometimes bundles several color/finish codes that share one ` +
    `price into a single cell (e.g. "CS, US" or "SM/PE/CT/NT") - report that header text exactly ` +
    `as it reads, comma/slash and all; the app splits it into separate tiers automatically, so ` +
    `don't try to pick just one code out of it.\n\n` +
    `For categoryBucketHints, this shop's own rule of thumb (use it as a guide, adapt to the ` +
    `actual category words you see, and it's fine to add more hints than these): pantry and ` +
    `closet-style cabinets -> DOUBLE, crown molding/trim -> MISC, ordinary base/wall/drawer-bank ` +
    `cabinets (including multi-drawer base cabinets - a 3-drawer base is still a standard ` +
    `cabinet, not a "double" one just because it has multiple drawers) -> STANDARD, anything ` +
    `explicitly marked custom or special-order -> CUSTOM, hardware/accessories/panels/fillers -> ` +
    `MISC. Try to give every distinct category you see a real hint rather than leaving most of ` +
    `them to fall through to defaultBucket.\n\n` +
    `IMPORTANT about hint text matching: categoryContains is a plain case-insensitive substring ` +
    `match against the real category text, with NO plural/singular normalization - a hint of ` +
    `"pantry" will NOT match category text that reads "PANTRIES" (plural), so that item would ` +
    `silently fall through to defaultBucket instead of getting the bucket you intended. Pick a ` +
    `substring that's actually present in the category text you observed (e.g. "pantr" instead ` +
    `of "pantry" so it matches both "PANTRY" and "PANTRIES"), or add a separate hint for each ` +
    `variant you see.\n\n` +
    installationItemsSection +
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

function validatePlan(
  raw: any,
  sheetNames: string[],
  installationItemKeys: string[],
): CabinetImportParsePlan {
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
  if (raw.sizeCol !== null && raw.sizeCol !== undefined && !Number.isInteger(raw.sizeCol)) {
    throw new Error("AI returned an invalid sizeCol.");
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

  // installationItemHints is only requested when installationItemKeys is
  // non-empty (see buildParsePlanTool) - default to [] otherwise. Any entry
  // referencing a key outside the list we actually offered is dropped
  // rather than throwing - a stale/hallucinated key should just leave that
  // category unmapped, not fail the whole import.
  const installationItemKeySet = new Set(installationItemKeys);
  const rawInstallationHints = Array.isArray(raw.installationItemHints)
    ? raw.installationItemHints
    : [];
  const installationItemHints = rawInstallationHints.filter(
    (h: any) =>
      typeof h?.categoryContains === "string" &&
      typeof h?.installationItemKey === "string" &&
      installationItemKeySet.has(h.installationItemKey),
  );

  const rawInstallationItemExclusions = Array.isArray(raw.installationItemExclusions)
    ? raw.installationItemExclusions
    : [];
  const installationItemExclusions = rawInstallationItemExclusions.filter(
    (p: any) => typeof p?.textContains === "string" && p.textContains.trim(),
  );

  return {
    sheetName: raw.sheetName,
    dataStartRow: raw.dataStartRow,
    codeCol: raw.codeCol,
    descriptionCol: raw.descriptionCol,
    sizeCol: Number.isInteger(raw.sizeCol) ? raw.sizeCol : null,
    priceColumns: raw.priceColumns.map((pc: any) => ({ col: pc.col, tierName: String(pc.tierName).trim() })),
    categoryMode: raw.categoryMode,
    categoryColumn: Number.isInteger(raw.categoryColumn) ? raw.categoryColumn : null,
    sectionDetectColumn: Number.isInteger(raw.sectionDetectColumn) ? raw.sectionDetectColumn : null,
    categoryBucketHints: hints.map((h: any) => ({
      categoryContains: String(h.categoryContains).trim(),
      bucket: h.bucket as CabinetSummaryBucket,
    })),
    defaultBucket: raw.defaultBucket,
    installationItemHints: installationItemHints.map((h: any) => ({
      categoryContains: String(h.categoryContains).trim(),
      installationItemKey: String(h.installationItemKey),
      confidence: h.confidence === "low" ? "low" : "high",
    })),
    installationItemExclusions: installationItemExclusions.map((p: any) => ({
      textContains: String(p.textContains).trim(),
    })),
  };
}

export async function inferCabinetImportParsePlan(input: {
  sheets: RawSheet[];
  vendorName: string;
  installationItems?: CabinetInstallationItemOption[];
  // Round 13: this vendor's catalog PDF (see CabinetVendor.catalogPdfUrl),
  // already fetched/base64-encoded/page-capped by cabinetCatalogPdf.ts -
  // this module never fetches it itself. Purely a classification aid (see
  // buildPrompt's catalogPdfSection) - never a source of prices/codes,
  // which still only ever come from applyParsePlan reading the actual
  // spreadsheet cells. Omitted/null when the vendor has no catalog
  // attached, or it couldn't be fetched/was too large - the import simply
  // proceeds without it, same as always.
  catalogPdfBase64?: string | null;
}): Promise<CabinetImportParsePlan> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Add it to your environment variables to use AI-assisted import.",
    );
  }

  const client = new Anthropic({ apiKey });
  const sheetNames = input.sheets.map((s) => s.sheetName);
  // Round 12 follow-up: any item with a bucketDefault (see the schema
  // comment on CabinetInstallationServiceItem.bucketDefault) is assigned
  // deterministically from the item's own CabinetSummaryBucket in
  // applyParsePlan() - never by the AI. Keep those rows out of what the AI
  // is even shown here, so it isn't tempted to guess at a mapping
  // (STANDARD/DOUBLE cabinet SKUs) that's already handled reliably and
  // guessed at hints for accessory-only rows instead.
  const allInstallationItems = input.installationItems || [];
  const installationItems = allInstallationItems.filter((it) => !it.bucketDefault);
  const installationItemKeys = installationItems.map(installationItemOptionKey);
  const parsePlanTool = buildParsePlanTool(installationItemKeys);

  const promptText = buildPrompt(
    input.sheets,
    input.vendorName,
    installationItems,
    Boolean(input.catalogPdfBase64),
  );

  // Round 13: when a catalog PDF is attached, it goes in as its own
  // document content block alongside the text prompt - Claude reads both
  // together in one call. Text-only when there's no catalog, unchanged
  // from before this feature existed.
  const content: Anthropic.MessageParam["content"] = input.catalogPdfBase64
    ? [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: input.catalogPdfBase64,
          },
        },
        { type: "text", text: promptText },
      ]
    : promptText;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [parsePlanTool],
    tool_choice: { type: "tool", name: parsePlanTool.name },
    messages: [
      {
        role: "user",
        content,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("AI did not return a structured parse plan.");
  }

  return validatePlan(toolUse.input, sheetNames, installationItemKeys);
}

/**
 * Extracts a reference image per catalog item from a vendor's attached
 * catalog PDF (CabinetVendor.catalogPdfUrl) - see the schema comment on
 * CabinetCatalogItem.catalogImageUrl. Purely cosmetic: this never reads or
 * writes a price, code, or description - those stay exactly as the price
 * list import set them. Two steps, repeated per page-range chunk (see
 * prepareCatalogPdfPageChunks in cabinetCatalogPdf.ts - a short but very
 * image-heavy catalog can easily be too big for Claude's PDF endpoint to
 * read in one request, so the catalog is split into several and each gets
 * its own pass):
 *
 *  1. Ask Claude (vision) to locate, for groups of item codes that share
 *     one illustration (very common - one drawing often covers a whole
 *     family of sizes), which page it's on and roughly where on that page
 *     (a fractional bounding box). Only item codes not yet matched by an
 *     earlier chunk are asked about, so later chunks get cheaper/faster
 *     and a code already matched in one chunk is never overwritten by a
 *     weaker guess from a later one.
 *  2. Render each referenced page and crop out each group's box (see
 *     cabinetCatalogPdfRender.ts), upload the crop, and point every code
 *     in that group at it.
 *
 * Best-effort throughout - a code the AI can't place, or a crop that fails
 * to render, is simply left without an image rather than blocking the rest
 * or being guessed at.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";
import { fetchCatalogPdfBytes, prepareCatalogPdfPageChunks, type PdfPageChunk } from "./cabinetCatalogPdf";
import { extractLayoutImages } from "./cabinetCatalogLayoutImages";
import { uploadCabinetCatalogItemImage } from "./cabinetCatalogStorage";
import { renderAndCropGroups, type VisualGroup } from "./cabinetCatalogPdfRender";

const prismaAny = prisma as any;
const MODEL = "claude-sonnet-5";

function buildVisualsTool() {
  return {
    name: "emit_item_visuals",
    description:
      "Report where each catalog item's representative illustration appears in the attached PDF.",
    input_schema: {
      type: "object" as const,
      properties: {
        groups: {
          type: "array",
          description:
            "One entry per distinct illustration in the catalog. Many vendors show a single " +
            "drawing for a whole family of related sizes (e.g. one box drawing above a table " +
            "listing B15FD, B18FD, B21FD) - list every code from the list below that shares that " +
            "exact picture together in one group, rather than repeating the same page/box once " +
            "per code.",
          items: {
            type: "object",
            properties: {
              codes: {
                type: "array",
                items: { type: "string" },
                description: "Item codes (exactly as given below) that share this illustration.",
              },
              page: {
                type: "integer",
                description: "1-indexed page number in the attached PDF where this illustration appears.",
              },
              box: {
                type: "object",
                description:
                  "The illustration's bounding box on that page, as fractions of the page's " +
                  "width/height (0 to 1), measured from the TOP-LEFT corner - x0,y0 is the box's " +
                  "top-left corner, x1,y1 its bottom-right corner. Err on the side of a SLIGHTLY " +
                  "LARGER box rather than a tight one - a little extra whitespace around the edges " +
                  "is fine, but a clipped drawing or clipped title/label text above it is not. If " +
                  "the illustration has a short title/label directly above or below it (e.g. " +
                  '"BASE OPEN SHELF"), include that text inside the box too. Exclude the larger ' +
                  "surrounding spec table/dimensions text where it's clearly separate from the " +
                  "drawing and its immediate label.",
                properties: {
                  x0: { type: "number" },
                  y0: { type: "number" },
                  x1: { type: "number" },
                  y1: { type: "number" },
                },
                required: ["x0", "y0", "x1", "y1"],
              },
            },
            required: ["codes", "page", "box"],
          },
        },
      },
      required: ["groups"],
    },
  };
}

function buildVisualsPrompt(vendorName: string, codes: string[]): string {
  return (
    `Attached is a page range from ${vendorName}'s product catalog (PDF) - it may not be the ` +
    `whole catalog. Below is the list of item codes that still need a reference picture. Many ` +
    `catalogs show ONE illustration for a whole family of related sizes - group every code that ` +
    `shares a picture together rather than reporting the same location once per code.\n\n` +
    `Only report codes that actually appear in this exact list - do not invent codes, and skip ` +
    `any code you can't find a real illustration for in THIS page range rather than guessing at ` +
    `one (it may simply be on a different page range, handled separately). This is a purely ` +
    `visual/cosmetic lookup, never a source of prices.\n\n` +
    `Codes still needed:\n${codes.join(", ")}\n\n` +
    `Call emit_item_visuals with every group you can confidently locate in this attached range.`
  );
}

export type ExtractVisualsResult = {
  totalCodes: number;
  groupsFound: number;
  imagesCreated: number;
  itemsUpdated: number;
  warnings: string[];
};

// One chunk's AI call + validate + render/crop pass. Returns the valid
// groups found (for stats) and mutates nothing itself - the caller owns
// uploading/saving so it can track which codes are already satisfied
// across chunks.
async function runVisualsPassForChunk(
  client: Anthropic,
  vendorName: string,
  chunk: PdfPageChunk,
  codesToAsk: string[],
  warnings: string[],
): Promise<VisualGroup[]> {
  if (codesToAsk.length === 0) return [];

  const tool = buildVisualsTool();
  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: chunk.base64 },
            },
            { type: "text", text: buildVisualsPrompt(vendorName, codesToAsk) },
          ],
        },
      ],
    });
  } catch (err: any) {
    warnings.push(
      `Couldn't scan pages ${chunk.startPage}-${chunk.startPage + chunk.pageCount - 1}: ${err.message || err}`,
    );
    return [];
  }

  if (message.stop_reason === "max_tokens") {
    warnings.push(
      `The AI's answer for pages ${chunk.startPage}-${chunk.startPage + chunk.pageCount - 1} was cut off, so some pictures there may be missing.`,
    );
  }
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    warnings.push(
      `AI didn't return any item locations for pages ${chunk.startPage}-${chunk.startPage + chunk.pageCount - 1}.`,
    );
    return [];
  }

  const codeSet = new Set(codesToAsk.map((c) => c.toLowerCase()));
  const rawGroups = Array.isArray((toolUse.input as any)?.groups) ? (toolUse.input as any).groups : [];

  const groups: VisualGroup[] = [];
  for (const g of rawGroups) {
    const groupCodes: string[] = Array.isArray(g?.codes)
      ? g.codes
          .map((c: unknown) => String(c).trim())
          .filter((c: string) => c && codeSet.has(c.toLowerCase()))
      : [];
    const page = Number(g?.page);
    const box = g?.box;
    const validBox =
      box &&
      [box.x0, box.y0, box.x1, box.y1].every(
        (n: unknown) => typeof n === "number" && Number.isFinite(n),
      ) &&
      box.x1 > box.x0 &&
      box.y1 > box.y0;

    if (
      groupCodes.length === 0 ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > chunk.pageCount ||
      !validBox
    ) {
      continue;
    }

    groups.push({
      codes: groupCodes,
      page,
      box: {
        x0: Math.max(0, Math.min(1, box.x0)),
        y0: Math.max(0, Math.min(1, box.y0)),
        x1: Math.max(0, Math.min(1, box.x1)),
        y1: Math.max(0, Math.min(1, box.y1)),
      },
    });
  }

  return groups;
}

export async function extractCatalogItemVisuals(vendorId: string): Promise<ExtractVisualsResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const vendor = await prismaAny.cabinetVendor.findUnique({
    where: { id: vendorId },
    select: { id: true, name: true, catalogPdfUrl: true },
  });
  if (!vendor) throw new Error("Vendor not found");
  if (!vendor.catalogPdfUrl) {
    throw new Error("This vendor has no catalog PDF attached yet.");
  }

  const items = await prismaAny.cabinetCatalogItem.findMany({
    where: { vendorId, isActive: true },
    select: { id: true, code: true },
  });
  if (items.length === 0) {
    throw new Error("This vendor has no active catalog items to match images to yet.");
  }

  const warnings: string[] = [];

  const allCodes: string[] = items.map((it: any) => it.code);
  const itemIdByCode = new Map<string, string>(
    items.map((it: any) => [String(it.code).toLowerCase(), it.id as string]),
  );
  const remainingCodes = new Set(allCodes);

  let groupsFound = 0;
  let imagesCreated = 0;
  let itemsUpdated = 0;

  // Pass 1 - by page layout (no AI): find each SKU in the PDF's text and take
  // the drawing printed beside its table. Exact and fast for catalogs laid
  // out like a price list (a drawing next to each table of SKUs).
  const pdfBytes = await fetchCatalogPdfBytes(vendor.catalogPdfUrl);
  if (!pdfBytes) {
    throw new Error("Could not read the attached catalog PDF - try re-uploading it.");
  }
  try {
    const layout = await extractLayoutImages(pdfBytes.slice(), allCodes);
    for (const group of layout.groups) {
      const codesStillNeeded = group.codes.filter((c) => remainingCodes.has(c));
      if (codesStillNeeded.length === 0) continue;
      groupsFound++;
      try {
        const url = await uploadCabinetCatalogItemImage(vendorId, codesStillNeeded[0], group.png);
        imagesCreated++;
        const idsToUpdate = codesStillNeeded
          .map((c) => itemIdByCode.get(c.toLowerCase()))
          .filter((id): id is string => Boolean(id));
        if (idsToUpdate.length > 0) {
          await prismaAny.cabinetCatalogItem.updateMany({
            where: { id: { in: idsToUpdate } },
            data: { catalogImageUrl: url },
          });
          itemsUpdated += idsToUpdate.length;
        }
        for (const c of codesStillNeeded) remainingCodes.delete(c);
      } catch (err: any) {
        warnings.push(`Failed to save image for ${codesStillNeeded.join(", ")}: ${err.message || err}`);
      }
    }
  } catch (err: any) {
    console.error("Cabinet catalog layout image pass failed:", err);
    warnings.push(`Reading the page layout failed (${err.message || err}); trying the AI instead.`);
  }

  // Pass 2 - ask the AI about whatever the layout pass could not place
  // (catalogs whose pictures aren't next to a table of SKUs).
  if (remainingCodes.size === 0) {
    return { totalCodes: allCodes.length, groupsFound, imagesCreated, itemsUpdated, warnings };
  }
  const prepared = await prepareCatalogPdfPageChunks(vendor.catalogPdfUrl);
  if (!prepared || prepared.chunks.length === 0) {
    warnings.push("Could not prepare the catalog PDF for the AI pass; some items have no picture.");
    return { totalCodes: allCodes.length, groupsFound, imagesCreated, itemsUpdated, warnings };
  }
  if (prepared.truncated) {
    warnings.push(
      `Catalog has ${prepared.totalPageCount} pages - only the first ${prepared.pagesCovered} could be ` +
        `scanned by the AI this run (file is very image-heavy). Re-run "Extract item images" again if some items ` +
        `are still missing a picture after this.`,
    );
  }
  const client = new Anthropic({ apiKey });

  for (const chunk of prepared.chunks) {
    if (remainingCodes.size === 0) break; // every item already has a match - skip the rest

    const codesToAsk = Array.from(remainingCodes);
    const groups = await runVisualsPassForChunk(client, vendor.name, chunk, codesToAsk, warnings);
    if (groups.length === 0) continue;
    groupsFound += groups.length;

    const rendered = await renderAndCropGroups(chunk.base64, groups);

    for (const result of rendered) {
      // A code may have been satisfied by an earlier group in this same
      // chunk already (shouldn't normally happen, but keep it consistent
      // with the across-chunk guard below).
      const codesStillNeeded = result.group.codes.filter((c) => remainingCodes.has(c));
      if (codesStillNeeded.length === 0) continue;

      if (!result.png) {
        warnings.push(`Couldn't render an image for ${codesStillNeeded.join(", ")}.`);
        continue;
      }
      try {
        const url = await uploadCabinetCatalogItemImage(vendorId, codesStillNeeded[0], result.png);
        imagesCreated++;
        const idsToUpdate = codesStillNeeded
          .map((c) => itemIdByCode.get(c.toLowerCase()))
          .filter((id): id is string => Boolean(id));
        if (idsToUpdate.length > 0) {
          await prismaAny.cabinetCatalogItem.updateMany({
            where: { id: { in: idsToUpdate } },
            data: { catalogImageUrl: url },
          });
          itemsUpdated += idsToUpdate.length;
        }
        for (const c of codesStillNeeded) remainingCodes.delete(c);
      } catch (err: any) {
        warnings.push(`Failed to save image for ${codesStillNeeded.join(", ")}: ${err.message || err}`);
      }
    }
  }

  if (groupsFound === 0) {
    warnings.push("The AI couldn't confidently locate any illustrations in this catalog.");
  }

  return {
    totalCodes: allCodes.length,
    groupsFound,
    imagesCreated,
    itemsUpdated,
    warnings,
  };
}

/**
 * Fetches a vendor's catalog PDF (see CabinetVendor.catalogPdfUrl) and
 * prepares it for the Claude API's native PDF/document support - shared by
 * cabinetCatalogImportAi.ts (classification hints, a single capped sample
 * is plenty for that) and cabinetCatalogVisuals.ts (cropped item images,
 * which needs to eventually cover the WHOLE catalog, not just a sample -
 * see prepareCatalogPdfPageChunks below).
 *
 * Claude's PDF support currently caps out around 100 pages / 32MB per
 * request - rather than failing the whole (optional, best-effort) catalog
 * feature when a vendor's real catalog is bigger than that, both functions
 * here trim by PAGE COUNT (MAX_PAGES) and, independently, by actual BYTE
 * SIZE (MAX_BYTES) - a short but very image-heavy catalog (lots of
 * full-color photos) can blow the byte budget well before it hits the page
 * cap, so page count alone isn't a reliable proxy for file size. Neither
 * function throws - a fetch/parse failure just means "proceed without the
 * catalog", same as "no catalog attached".
 */

import { PDFDocument } from "pdf-lib";

const MAX_PAGES = 100;
// Anthropic's Messages API caps the TOTAL request body (for an inline PDF,
// that means the base64-ENCODED document plus the rest of the JSON - tool
// schema, the item-code list, etc.) at roughly 32MB. Base64 inflates raw
// bytes by ~4/3, so budgeting MAX_BYTES against raw PDF bytes (as this used
// to) silently let the actual encoded request run well past that limit -
// caught in production by a real 413 ("Request exceeds the maximum size")
// on an unusually photo-dense page range. MAX_BASE64_BYTES is the real
// budget (encoded size, with real headroom left for the JSON wrapper);
// MAX_BYTES is the equivalent RAW byte ceiling derived from it.
const MAX_BASE64_BYTES = 22 * 1024 * 1024; // ~22MB of base64 text
const MAX_BYTES = Math.floor((MAX_BASE64_BYTES * 3) / 4); // ~16.5MB raw PDF bytes
// Safety cap on how many chunks a single "Extract item images" run will
// make AI calls for - bounds worst-case time/cost on an enormous catalog.
// Smaller MAX_BYTES means more, smaller chunks than before, so this is
// raised accordingly to still comfortably cover a heavy multi-page catalog.
const MAX_CHUNKS = 14;

export type PreparedCatalogPdf = {
  base64: string;
  pageCount: number; // pages actually included (after any trimming)
  totalPageCount: number; // pages in the original file, for a truthful warning
  truncated: boolean;
};

export type PdfPageChunk = {
  base64: string;
  startPage: number; // 1-indexed page number in the ORIGINAL file this chunk starts at
  pageCount: number; // pages in this chunk (page numbers inside its own base64 are 1..pageCount)
};

export type PreparedCatalogPdfChunks = {
  chunks: PdfPageChunk[];
  totalPageCount: number; // pages in the original file
  pagesCovered: number; // how many of those pages ended up in some chunk
  truncated: boolean; // pagesCovered < totalPageCount (hit MAX_PAGES or MAX_CHUNKS)
};

async function fetchAndLoadPdf(
  url: string,
  label: string,
): Promise<{ doc: PDFDocument; arrayBuffer: ArrayBuffer } | null> {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`${label}: fetch failed, status ${res.status} ${res.statusText} for ${url}`);
    return null;
  }
  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    console.error(`${label}: fetched 0 bytes from ${url}`);
    return null;
  }
  try {
    const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    return { doc, arrayBuffer };
  } catch (parseErr) {
    console.error(
      `${label}: pdf-lib could not parse the file (${arrayBuffer.byteLength} bytes) from ${url}:`,
      parseErr,
    );
    return null;
  }
}

async function buildPageRangeSubset(
  doc: PDFDocument,
  startIndex: number,
  count: number,
): Promise<Uint8Array> {
  const trimmed = await PDFDocument.create();
  const indices = Array.from({ length: count }, (_, i) => startIndex + i);
  const pages = await trimmed.copyPages(doc, indices);
  for (const page of pages) trimmed.addPage(page);
  return trimmed.save();
}

// Builds one subset starting at `startIndex` (0-indexed into the original
// doc) that fits under MAX_BYTES, starting from `pageGuess` pages and
// refining downward a few times using the actual bytes/page it measures -
// cheaper than a full binary search for an image-heavy multi-page PDF
// where each save() isn't free, at the cost of occasionally needing a
// second or third attempt rather than finding the exact optimum in one.
async function fitPageRangeToByteBudget(
  doc: PDFDocument,
  startIndex: number,
  maxCount: number,
  pageGuess: number,
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  let guess = Math.max(1, Math.min(maxCount, pageGuess));
  for (let attempt = 0; attempt < 5 && guess >= 1; attempt++) {
    const candidate = await buildPageRangeSubset(doc, startIndex, guess);
    if (candidate.byteLength <= MAX_BYTES) {
      return { bytes: candidate, pageCount: guess };
    }
    const overBy = candidate.byteLength / MAX_BYTES;
    let next = Math.max(1, Math.floor(guess / overBy / 1.1));
    if (next >= guess) next = guess - 1;
    if (next < 1) break;
    guess = next;
  }
  // Last resort: a single page, whatever its size - still better than
  // skipping this part of the catalog outright.
  const bytes = await buildPageRangeSubset(doc, startIndex, 1);
  return { bytes, pageCount: 1 };
}

/**
 * Single capped sample of the catalog - used for the import-preview AI's
 * classification hints, where general visual context from the front of
 * the catalog is enough; no need to cover every page for that.
 */
export async function fetchAndPrepareCatalogPdf(
  url: string,
): Promise<PreparedCatalogPdf | null> {
  try {
    const loaded = await fetchAndLoadPdf(url, "fetchAndPrepareCatalogPdf");
    if (!loaded) return null;
    const { doc, arrayBuffer } = loaded;

    const totalPageCount = doc.getPageCount();
    const pageCapped = Math.min(totalPageCount, MAX_PAGES);

    let bytes: Uint8Array;
    let pageCount: number;

    if (pageCapped === totalPageCount) {
      bytes = new Uint8Array(arrayBuffer);
      pageCount = totalPageCount;
    } else {
      bytes = await buildPageRangeSubset(doc, 0, pageCapped);
      pageCount = pageCapped;
    }

    if (bytes.byteLength > MAX_BYTES) {
      const avgBytesPerPage = bytes.byteLength / pageCount;
      const guess = Math.max(1, Math.min(pageCount - 1, Math.floor((MAX_BYTES / avgBytesPerPage) * 0.85)));
      const fitted = await fitPageRangeToByteBudget(doc, 0, pageCount - 1, guess);
      bytes = fitted.bytes;
      pageCount = fitted.pageCount;
      console.error(
        `fetchAndPrepareCatalogPdf: trimmed to ${pageCount} of ${totalPageCount} pages by size (${bytes.byteLength} bytes) for ${url}`,
      );
    }

    const truncated = pageCount < totalPageCount;
    const base64 = Buffer.from(bytes).toString("base64");
    return { base64, pageCount, totalPageCount, truncated };
  } catch (err) {
    console.error(`fetchAndPrepareCatalogPdf: unexpected error for ${url}:`, err);
    return null;
  }
}

/**
 * Splits the catalog into successive page-range chunks, each on its own
 * fitting under MAX_BYTES, so a short-but-heavy catalog (lots of full-page
 * photos, e.g. 80 pages / 90MB+) can still be scanned in full across
 * several AI calls instead of only ever seeing its first few pages. Used
 * by "Extract item images" (cabinetCatalogVisuals.ts), which loops these
 * chunks and asks about only the item codes not yet matched in an earlier
 * chunk, so later chunks get cheaper/faster as fewer codes remain.
 */
export async function prepareCatalogPdfPageChunks(
  url: string,
): Promise<PreparedCatalogPdfChunks | null> {
  try {
    const loaded = await fetchAndLoadPdf(url, "prepareCatalogPdfPageChunks");
    if (!loaded) return null;
    const { doc, arrayBuffer } = loaded;

    const totalPageCount = doc.getPageCount();
    const overallCap = Math.min(totalPageCount, MAX_PAGES);
    const roughAvgBytesPerPage = arrayBuffer.byteLength / Math.max(1, totalPageCount);

    const chunks: PdfPageChunk[] = [];
    let cursor = 0; // 0-indexed into the original doc

    while (cursor < overallCap && chunks.length < MAX_CHUNKS) {
      const remaining = overallCap - cursor;
      const guess = Math.max(1, Math.min(remaining, Math.floor((MAX_BYTES / roughAvgBytesPerPage) * 0.85)));
      const fitted = await fitPageRangeToByteBudget(doc, cursor, remaining, guess);
      chunks.push({
        base64: Buffer.from(fitted.bytes).toString("base64"),
        startPage: cursor + 1,
        pageCount: fitted.pageCount,
      });
      cursor += fitted.pageCount;
    }

    const truncated = cursor < totalPageCount;
    if (truncated) {
      console.error(
        `prepareCatalogPdfPageChunks: covered ${cursor} of ${totalPageCount} pages across ${chunks.length} chunks (hit MAX_PAGES/MAX_CHUNKS) for ${url}`,
      );
    }

    return { chunks, totalPageCount, pagesCovered: cursor, truncated };
  } catch (err) {
    console.error(`prepareCatalogPdfPageChunks: unexpected error for ${url}:`, err);
    return null;
  }
}

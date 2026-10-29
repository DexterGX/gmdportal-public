/**
 * Pure PDF-page-to-cropped-PNG rendering - no AI, Prisma, or Supabase here.
 * Isolated in its own file because it's the one piece of this feature
 * touching non-trivial native-adjacent plumbing (pdfjs-dist's Node/"legacy"
 * build + @napi-rs/canvas's prebuilt native binary, see next.config.js's
 * serverExternalPackages) rather than ordinary application logic, so a
 * rendering problem is easy to isolate and retest on its own.
 *
 * Deliberately uses @napi-rs/canvas instead of the more common `canvas`
 * package - @napi-rs/canvas ships prebuilt binaries per platform (no
 * node-gyp/cairo build step), which is what makes this workable in a
 * Vercel serverless function at all.
 */

import { createCanvas, type Canvas } from "@napi-rs/canvas";

export type VisualGroup = {
  codes: string[];
  page: number; // 1-indexed
  box: { x0: number; y0: number; x1: number; y1: number }; // 0-1 fractions of the page, top-left origin
};

export type RenderedGroup = {
  group: VisualGroup;
  png: Buffer | null;
};

// ~144dpi equivalent for a standard 72dpi PDF page - sharp enough for a
// small reference thumbnail without producing huge files.
const RENDER_SCALE = 2;
// Breathing room around the AI's box so a tight (or slightly misjudged)
// guess doesn't clip the drawing or its title/label text. Two components:
// a fraction of the BOX's own size (scales with how big the illustration
// is) and a fraction of the PAGE's size as a floor (so a small/tight box
// still gets a real minimum buffer, not a sliver). The AI's boxes have
// turned out to run tight rather than generous in practice, so this errs
// toward extra surrounding whitespace over a clipped edge.
const CROP_PADDING_FRACTION = 0.08;
const CROP_MIN_PADDING_PAGE_FRACTION = 0.015;

// pdfjs-dist's Node ("legacy") build is ESM-only (.mjs) - loaded with a
// dynamic import() rather than a static one so this still works regardless
// of whether the surrounding bundle is emitted as CJS or ESM. Cached so
// repeated calls within the same server instance don't redo this.
//
// Node has no browser Worker, so pdfjs normally needs a resolvable file
// path (GlobalWorkerOptions.workerSrc) to run its inline "fake worker"
// fallback. Resolving that path with createRequire(...).resolve(...) works
// in plain Node but Next.js's webpack build rejects it ("ESM packages ...
// need to be imported. Use 'import' to reference the package instead"),
// because it statically flags any require()/require.resolve() call that
// targets an ESM-only (.mjs) file. The fix pdfjs-dist itself documents for
// Node: dynamically import() the worker module directly. Loading it into
// the same process as the main library makes it self-register as the
// available worker, so workerSrc never needs to be set at all - no
// require.resolve()/createRequire() involved, which is also what keeps
// this working under Next's bundler.
let pdfjsLibPromise: Promise<any> | null = null;
export async function getPdfjsLib(): Promise<any> {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
      // Side-effect import only - registers itself as pdfjs's in-process
      // worker. Intentionally not using the returned module.
      // pdf.worker.mjs ships no type declarations (TS7016 under strict).
      // @ts-ignore
      await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
      return pdfjsLib;
    })();
  }
  return pdfjsLibPromise;
}

export class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height)));
    const context = canvas.getContext("2d");
    return { canvas, context };
  }
  reset(canvasAndContext: { canvas: Canvas }, width: number, height: number) {
    canvasAndContext.canvas.width = Math.max(1, Math.ceil(width));
    canvasAndContext.canvas.height = Math.max(1, Math.ceil(height));
  }
  destroy(canvasAndContext: { canvas: Canvas | null; context: unknown }) {
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

/**
 * Renders every distinct page referenced by `groups` exactly once, then
 * crops each group's box out of that page's render - a catalog page
 * usually holds several item families, so this avoids re-rendering the
 * same page once per group. A group whose page fails to render, or whose
 * crop fails, comes back with png: null rather than throwing - the caller
 * decides how to report that (see cabinetCatalogVisuals.ts).
 */
export async function renderAndCropGroups(
  pdfBase64: string,
  groups: VisualGroup[],
): Promise<RenderedGroup[]> {
  const pdfjsLib = await getPdfjsLib();
  const data = new Uint8Array(Buffer.from(pdfBase64, "base64"));
  const loadingTask = pdfjsLib.getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const doc = await loadingTask.promise;

  const groupsByPage = new Map<number, VisualGroup[]>();
  for (const g of groups) {
    if (!groupsByPage.has(g.page)) groupsByPage.set(g.page, []);
    groupsByPage.get(g.page)!.push(g);
  }

  const results: RenderedGroup[] = [];
  const canvasFactory = new NodeCanvasFactory();

  for (const [pageNum, pageGroups] of groupsByPage) {
    let canvasAndContext: { canvas: Canvas; context: any } | null = null;
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      canvasAndContext = canvasFactory.create(viewport.width, viewport.height) as {
        canvas: Canvas;
        context: any;
      };
      const renderTask = page.render({
        canvasContext: canvasAndContext.context,
        viewport,
        canvasFactory,
      });
      await renderTask.promise;
    } catch {
      for (const group of pageGroups) results.push({ group, png: null });
      continue;
    }

    const pageWidth = canvasAndContext.canvas.width;
    const pageHeight = canvasAndContext.canvas.height;

    for (const group of pageGroups) {
      try {
        const padX = Math.max(
          (group.box.x1 - group.box.x0) * CROP_PADDING_FRACTION,
          CROP_MIN_PADDING_PAGE_FRACTION,
        );
        const padY = Math.max(
          (group.box.y1 - group.box.y0) * CROP_PADDING_FRACTION,
          CROP_MIN_PADDING_PAGE_FRACTION,
        );
        const x0 = Math.max(0, group.box.x0 - padX);
        const y0 = Math.max(0, group.box.y0 - padY);
        const x1 = Math.min(1, group.box.x1 + padX);
        const y1 = Math.min(1, group.box.y1 + padY);

        const cropX = Math.round(x0 * pageWidth);
        const cropY = Math.round(y0 * pageHeight);
        const cropW = Math.max(1, Math.round((x1 - x0) * pageWidth));
        const cropH = Math.max(1, Math.round((y1 - y0) * pageHeight));

        const cropCanvas = createCanvas(cropW, cropH);
        const cropCtx = cropCanvas.getContext("2d");
        cropCtx.drawImage(
          canvasAndContext.canvas,
          cropX,
          cropY,
          cropW,
          cropH,
          0,
          0,
          cropW,
          cropH,
        );
        const png = cropCanvas.toBuffer("image/png");
        results.push({ group, png: Buffer.from(png) });
      } catch {
        results.push({ group, png: null });
      }
    }

    canvasFactory.destroy(canvasAndContext);
  }

  return results;
}

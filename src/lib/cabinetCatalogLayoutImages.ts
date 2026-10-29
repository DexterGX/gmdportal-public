/**
 * Finds each catalog item's reference drawing by PAGE LAYOUT instead of asking
 * the AI where it is. Most price-list style catalogs print a table of SKUs
 * (e.g. "2DB12, 2DB15, 2DB18...") with the line drawing for that table in the
 * blank space to the LEFT of it. So, for every page:
 *
 *  1. Read the page's text layer and find the item codes of this vendor.
 *  2. Group those codes into table blocks (rows that are close together).
 *  3. Render the page and look at the strip left of the tables: every
 *     connected drawing there (title bars and big photos are ignored) is a
 *     candidate picture.
 *  4. Give each table block the picture that sits beside it, crop it out, and
 *     hand back one PNG per picture with the codes that share it.
 *
 * Pure geometry/pixels - no AI, no database. Codes it cannot place are simply
 * not returned; the caller can hand those to the AI fallback.
 */

import { createCanvas } from "@napi-rs/canvas";
import { getPdfjsLib, NodeCanvasFactory } from "./cabinetCatalogPdfRender";

const SCALE = 2; // render scale (pixels per PDF point)
const DILATE = 3; // points: pixels this close belong to the same drawing
const LUMA_INK = 225; // darker than this counts as ink
const CROP_PAD = 6; // points of white space kept around a crop
const MIN_DRAWING = 20; // points: smaller blobs are labels/ticks, not drawings
const MIN_DRAWING_INK = 600; // ink cells: a few depth/dimension lines are not a drawing
const MAX_DENSITY = 0.4; // solid blobs (photos, title bars) are not line drawings
const MIN_PART = 40; // points: shortest picture a shared drawing is split into
const MAX_PAGE_RENDERS = 120;

export type LayoutImageGroup = {
  codes: string[]; // codes exactly as the caller supplied them
  page: number; // 1-indexed page of the original file
  png: Buffer;
};

export type LayoutImageResult = {
  groups: LayoutImageGroup[];
  pagesWithCodes: number;
};

type TextBit = { str: string; x: number; y: number; w: number; h: number; rotated: boolean };
type Block = { y0: number; y1: number; codes: string[] };
type Comp = { id: number; x0: number; y0: number; x1: number; y1: number; count: number };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];
}

function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

/** Rows of codes that sit in one column close together = one printed table. */
function buildBlocks(skus: (TextBit & { code: string })[]): { x: number; blocks: Block[] } | null {
  if (skus.length === 0) return null;
  // The left-most column of codes is the one with a picture beside it.
  const minX = Math.min(...skus.map((s) => s.x));
  const column = skus.filter((s) => Math.abs(s.x - minX) < 30).sort((a, b) => a.y - b.y);
  const diffs: number[] = [];
  for (let i = 1; i < column.length; i++) diffs.push(column[i].y - column[i - 1].y);
  const pitch = Math.max(6, median(diffs.filter((d) => d > 0 && d < 40)) || 11);
  const blocks: Block[] = [];
  let cur: Block | null = null;
  let lastY = 0;
  for (const s of column) {
    if (cur && s.y - lastY <= pitch * 1.8) {
      cur.y1 = s.y;
      cur.codes.push(s.code);
    } else {
      cur = { y0: s.y, y1: s.y, codes: [s.code] };
      blocks.push(cur);
    }
    lastY = s.y;
  }
  return { x: minX, blocks };
}

/** Connected blobs of ink (after dilation) in a binary 1pt-per-cell mask. */
function findComponents(
  ink: Uint8Array,
  w: number,
  h: number,
): { comps: Comp[]; labels: Int32Array } {
  // Dilate by DILATE in both directions (box filter, two passes).
  const horiz = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let count = 0;
    for (let x = -DILATE; x < w; x++) {
      const add = x + DILATE;
      if (add < w && ink[row + add]) count++;
      const drop = x - DILATE - 1;
      if (drop >= 0 && ink[row + drop]) count--;
      if (x >= 0 && count > 0) horiz[row + x] = 1;
    }
  }
  const dil = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let y = -DILATE; y < h; y++) {
      const add = y + DILATE;
      if (add < h && horiz[add * w + x]) count++;
      const drop = y - DILATE - 1;
      if (drop >= 0 && horiz[drop * w + x]) count--;
      if (y >= 0 && count > 0) dil[y * w + x] = 1;
    }
  }

  const seen = new Uint8Array(w * h);
  const labels = new Int32Array(w * h); // component id + 1 (0 = background)
  const comps: Comp[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!dil[start] || seen[start]) continue;
    const comp: Comp = { id: comps.length, x0: w, y0: h, x1: -1, y1: -1, count: 0 };
    stack.push(start);
    seen[start] = 1;
    while (stack.length > 0) {
      const p = stack.pop()!;
      labels[p] = comp.id + 1;
      const px = p % w;
      const py = (p - px) / w;
      if (ink[p]) {
        comp.count++;
        if (px < comp.x0) comp.x0 = px;
        if (px > comp.x1) comp.x1 = px;
        if (py < comp.y0) comp.y0 = py;
        if (py > comp.y1) comp.y1 = py;
      }
      if (px > 0 && dil[p - 1] && !seen[p - 1]) {
        seen[p - 1] = 1;
        stack.push(p - 1);
      }
      if (px < w - 1 && dil[p + 1] && !seen[p + 1]) {
        seen[p + 1] = 1;
        stack.push(p + 1);
      }
      if (py > 0 && dil[p - w] && !seen[p - w]) {
        seen[p - w] = 1;
        stack.push(p - w);
      }
      if (py < h - 1 && dil[p + w] && !seen[p + w]) {
        seen[p + w] = 1;
        stack.push(p + w);
      }
    }
    if (comp.x1 >= 0) comps.push(comp);
  }
  return { comps, labels };
}

/**
 * @param pdfBytes the whole catalog PDF
 * @param codes the vendor's item codes still needing a picture
 */
export async function extractLayoutImages(
  pdfBytes: Uint8Array,
  codes: string[],
): Promise<LayoutImageResult> {
  const codeByLower = new Map<string, string>();
  for (const c of codes) {
    const key = c.trim().toLowerCase();
    // Prices/sizes are numbers; a real SKU has a letter and some length.
    if (key.length >= 3 && /[a-z]/.test(key)) codeByLower.set(key, c);
  }
  if (codeByLower.size === 0) return { groups: [], pagesWithCodes: 0 };

  const pdfjsLib = await getPdfjsLib();
  const doc = await pdfjsLib.getDocument({
    data: pdfBytes,
    disableFontFace: true,
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const groups: LayoutImageGroup[] = [];
  const claimed = new Set<string>(); // lower-case codes already given a picture
  const canvasFactory = new NodeCanvasFactory();
  let pagesWithCodes = 0;
  let renders = 0;

  for (let pageNum = 1; pageNum <= doc.numPages && renders < MAX_PAGE_RENDERS; pageNum++) {
    try {
      const page = await doc.getPage(pageNum);
      const vp1 = page.getViewport({ scale: 1 });
      const text = await page.getTextContent();
      const bits: TextBit[] = [];
      for (const raw of text.items as any[]) {
        if (typeof raw.str !== "string" || !raw.str.trim()) continue;
        const t = raw.transform as number[];
        const [x, y] = vp1.convertToViewportPoint(t[4], t[5]);
        bits.push({
          str: raw.str.trim(),
          x,
          y,
          w: Number(raw.width) || 0,
          h: Number(raw.height) || 8,
          rotated: Math.abs(t[1]) > 0.01 || Math.abs(t[2]) > 0.01,
        });
      }

      const skus: (TextBit & { code: string })[] = [];
      for (const b of bits) {
        const code = codeByLower.get(b.str.toLowerCase());
        if (code && !claimed.has(code.toLowerCase())) skus.push({ ...b, code });
      }
      const built = buildBlocks(skus);
      if (!built || built.blocks.length === 0) continue;
      pagesWithCodes++;

      // Left edge of the printed table = where the size/description text
      // that shares a row with the codes starts.
      const rows = skus.filter((s) => Math.abs(s.x - built.x) < 30).map((s) => s.y);
      const tableTextXs = bits
        .filter(
          (b) =>
            !b.rotated &&
            b.x < built.x - 1 &&
            b.x > built.x - 200 &&
            rows.some((ry) => Math.abs(ry - b.y) < 3),
        )
        .map((b) => b.x);
      const stripRight = Math.floor(Math.min(built.x, ...(tableTextXs.length ? tableTextXs : [built.x])) - 6);
      if (stripRight < 40) continue;

      // Render the page and look at the strip left of the table.
      const viewport = page.getViewport({ scale: SCALE });
      const cc = canvasFactory.create(viewport.width, viewport.height) as { canvas: any; context: any };
      await page.render({ canvasContext: cc.context, viewport, canvasFactory }).promise;
      renders++;
      const ctx = cc.context;

      // Paragraphs of notes beside a drawing are not part of it.
      ctx.fillStyle = "#ffffff";
      const firstBlockTop = built.blocks[0].y0;
      for (const b of bits) {
        // (Text above the first table is the page title on its colored bar.)
        if (b.rotated || b.str.length < 8 || b.x > stripRight || b.y < firstBlockTop - 20) continue;
        ctx.fillRect((b.x - 1) * SCALE, (b.y - b.h - 1) * SCALE, (b.w + 2) * SCALE, (b.h * 1.4 + 2) * SCALE);
      }

      // Short text (dimension labels) sitting in the picture strip.
      const labelBoxes = bits
        .filter((b) => b.str.length < 8 && b.x < stripRight)
        .map((b) => ({ x0: b.x, x1: b.x + Math.max(b.w, b.h), y0: b.y - b.h, y1: b.y + b.h * 0.3 }));

      const pageW = Math.ceil(vp1.width);
      const pageH = Math.ceil(vp1.height);
      const stripW = Math.min(stripRight, pageW);
      const px = ctx.getImageData(0, 0, stripW * SCALE, pageH * SCALE);
      const ink = new Uint8Array(stripW * pageH);
      const rowBytes = stripW * SCALE * 4;
      for (let y = 0; y < pageH; y++) {
        for (let x = 0; x < stripW; x++) {
          let dark = false;
          for (let dy = 0; dy < SCALE && !dark; dy++) {
            for (let dx = 0; dx < SCALE; dx++) {
              const o = (y * SCALE + dy) * rowBytes + (x * SCALE + dx) * 4;
              const luma = 0.3 * px.data[o] + 0.59 * px.data[o + 1] + 0.11 * px.data[o + 2];
              if (luma < LUMA_INK && px.data[o + 3] > 0) {
                dark = true;
                break;
              }
            }
          }
          if (dark) ink[y * stripW + x] = 1;
        }
      }

      const { comps, labels } = findComponents(ink, stripW, pageH);
      const drawings: Comp[] = [];
      const small: Comp[] = [];
      for (const c of comps) {
        const w = c.x1 - c.x0 + 1;
        const h = c.y1 - c.y0 + 1;
        const density = c.count / (w * h);
        const isTitleBar = w >= stripW * 0.5 && h <= 90 && density > 0.3;
        if (isTitleBar) continue;
        if (w >= MIN_DRAWING && h >= MIN_DRAWING && c.count >= MIN_DRAWING_INK) {
          // Big solid blobs (photos) are not line drawings.
          if (density <= MAX_DENSITY) drawings.push(c);
        } else {
          // Dimension text, ticks, arrows - kept so they can join a drawing.
          small.push(c);
        }
      }
      if (drawings.length === 0) {
        canvasFactory.destroy(cc);
        continue;
      }

      // Each table block takes the drawing beside it.
      const blocksByDrawing = new Map<Comp, Block[]>();
      for (const block of built.blocks) {
        const top = block.y0 - 10;
        const bottom = block.y1 + 3;
        let best: Comp | null = null;
        let bestScore = 0;
        for (const d of drawings) {
          const ov = overlap(top, bottom, d.y0, d.y1);
          if (ov > bestScore) {
            best = d;
            bestScore = ov;
          }
        }
        if (!best) {
          const mid = (top + bottom) / 2;
          let bestDist = 70;
          for (const d of drawings) {
            const dist = Math.abs((d.y0 + d.y1) / 2 - mid);
            if (dist < bestDist) {
              best = d;
              bestDist = dist;
            }
          }
        }
        if (!best) continue;
        const list = blocksByDrawing.get(best) || [];
        list.push(block);
        blocksByDrawing.set(best, list);
      }

      // Crops the page render to a region, keeping only the ink of the given
      // components - a neighbouring drawing's corner must not leak in.
      const cropRegion = (
        rx0: number,
        ry0: number,
        rx1: number,
        ry1: number,
        included: Set<number>,
      ): Buffer => {
        const cx0 = Math.max(0, Math.floor(rx0 - CROP_PAD));
        const cy0 = Math.max(0, Math.floor(ry0 - CROP_PAD));
        const cx1 = Math.min(stripW, Math.ceil(rx1 + CROP_PAD + 1));
        const cy1 = Math.min(pageH, Math.ceil(ry1 + CROP_PAD + 1));
        const cw = Math.max(1, (cx1 - cx0) * SCALE);
        const ch = Math.max(1, (cy1 - cy0) * SCALE);
        const crop = createCanvas(cw, ch);
        const cctx = crop.getContext("2d");
        cctx.drawImage(cc.canvas, cx0 * SCALE, cy0 * SCALE, cw, ch, 0, 0, cw, ch);
        cctx.fillStyle = "#ffffff";
        for (let y = cy0; y < cy1; y++) {
          for (let x = cx0; x < cx1; x++) {
            const label = labels[y * stripW + x];
            if (label !== 0 && !included.has(label - 1)) {
              cctx.fillRect((x - cx0) * SCALE, (y - cy0) * SCALE, SCALE, SCALE);
            }
          }
        }
        return Buffer.from(crop.toBuffer("image/png"));
      };

      for (const [drawing, drawingBlocks] of blocksByDrawing) {
        // Pull in the drawing's own labels (dimension text, ticks) - beside
        // the drawing and level with it, not above/below it.
        const included = new Set<number>([drawing.id]);
        let { x0, x1, y0, y1 } = drawing;
        for (const sm of small) {
          const near = (m: number) =>
            sm.x1 >= x0 - m && sm.x0 <= x1 + m && sm.y1 >= drawing.y0 - m && sm.y0 <= drawing.y1 + m;
          // Dimension text ("12\"", "30\" OR 24\"") belongs to the picture even
          // though each label is only a few dots of ink.
          const isLabel = labelBoxes.some(
            (l) => sm.x1 >= l.x0 - 2 && sm.x0 <= l.x1 + 2 && sm.y1 >= l.y0 - 2 && sm.y0 <= l.y1 + 2,
          );
          if ((sm.count >= 8 && near(22)) || (isLabel && near(40))) {
            included.add(sm.id);
            x0 = Math.min(x0, sm.x0);
            x1 = Math.max(x1, sm.x1);
            y0 = Math.min(y0, sm.y0);
            y1 = Math.max(y1, sm.y1);
          }
        }

        // Several tables share one blob when their drawings sit close
        // together (e.g. single-door above double-door): cut it at the
        // blank rows between them so each table gets its own picture.
        let parts: { y0: number; y1: number; blocks: Block[] }[] = [
          { y0, y1, blocks: drawingBlocks },
        ];
        if (drawingBlocks.length >= 2) {
          const rowInk: number[] = [];
          for (let y = y0; y <= y1; y++) {
            let n = 0;
            for (let x = x0; x <= x1; x++) {
              const label = labels[y * stripW + x];
              if (label !== 0 && included.has(label - 1) && ink[y * stripW + x]) n++;
            }
            rowInk.push(n);
          }
          // Valleys: runs of rows with (almost) no ink. The deepest ones
          // between the blocks are where the pictures meet.
          const lowLimit = Math.max(3, Math.floor((x1 - x0 + 1) * 0.035));
          const runs: { a: number; b: number; cut: number; len: number }[] = [];
          let runStart = -1;
          for (let i = 0; i <= rowInk.length; i++) {
            const low = i < rowInk.length && rowInk[i] <= lowLimit;
            if (low && runStart < 0) runStart = i;
            if (!low && runStart >= 0) {
              const a = runStart;
              const b = i - 1;
              runStart = -1;
              // Needs real drawing on both sides, and a couple of rows of depth.
              if (a > 0 && b < rowInk.length - 1 && b - a + 1 >= 2) {
                let cut = a;
                for (let r = a; r <= b; r++) if (rowInk[r] < rowInk[cut]) cut = r;
                runs.push({ a, b, cut, len: b - a + 1 });
              }
            }
          }
          const needed = drawingBlocks.length - 1;
          // A real picture is never a sliver: valleys that would leave a thin
          // strip are label gaps inside ONE drawing shared by several tables.
          const usable = runs.filter(
            (r) => r.cut >= MIN_PART && rowInk.length - 1 - r.cut >= MIN_PART,
          );
          if (usable.length >= needed) {
            const chosen = [...usable]
              .sort((p, q) => q.len - p.len)
              .slice(0, needed)
              .sort((p, q) => p.cut - q.cut);
            const edges = [0, ...chosen.map((r) => r.cut), rowInk.length - 1];
            const tallEnough = edges.every((e, i) => i === 0 || e - edges[i - 1] >= MIN_PART);
            // Every picture needs real drawing in it (not just dimension lines).
            const inkEnough = edges.every((e, i) => {
              if (i === 0) return true;
              let sum = 0;
              for (let r = edges[i - 1]; r <= e; r++) sum += rowInk[r];
              return sum >= MIN_DRAWING_INK;
            });
            if (tallEnough && inkEnough) {
              const ordered = [...drawingBlocks].sort((p, q) => p.y0 - q.y0);
              parts = ordered.map((bl, i) => ({
                y0: y0 + edges[i] + (i > 0 ? 1 : 0),
                y1: y0 + edges[i + 1],
                blocks: [bl],
              }));
            }
          }
        }

        for (const part of parts) {
          const png = cropRegion(x0, part.y0, x1, part.y1, included);
          const unique = Array.from(new Set(part.blocks.flatMap((bl) => bl.codes)));
          groups.push({ codes: unique, page: pageNum, png });
          for (const c of unique) claimed.add(c.toLowerCase());
        }
      }
      canvasFactory.destroy(cc);
    } catch (err) {
      console.error(`extractLayoutImages: page ${pageNum} failed:`, err);
    }
  }

  return { groups, pagesWithCodes };
}

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
import { normalizeCabinetCode } from "./cabinetCodeMatch";

const SCALE = 2; // render scale (pixels per PDF point)
const DILATE = 3; // points: pixels this close belong to the same drawing
const LUMA_INK = 225; // darker than this counts as ink
const CROP_PAD = 6; // points of white space kept around a crop
const MIN_DRAWING = 20; // points: smaller blobs are labels/ticks, not drawings
const MIN_DRAWING_INK = 600; // ink cells: a few depth/dimension lines are not a drawing
const MAX_DENSITY = 0.85; // solid black blobs (title/note bars) are not drawings; heavy line art and photos are
const MIN_PART = 40; // points: shortest picture a shared drawing is split into
const SIDE_BY_SIDE_GAP = 30; // points: drawings this close and level with each other are one picture
const RULE_MIN_H = 40; // points: a table rule is at least this long where it enters the strip
const RULE_MIN_V = 60; // points: shortest vertical cell border
const FRAME_MIN_V = 200; // points: a vertical line this tall is the table's frame, never a drawing
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
type Comp = { id: number; x0: number; y0: number; x1: number; y1: number; count: number; ids?: number[] };

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
  // The left-most COLUMN of codes is the one with a picture beside it. A
  // caption under a photo that happens to be a code ("CORBF", "CORK30") is not
  // a column: group the codes by x and only count columns with several rows.
  const byX = [...skus].sort((a, b) => a.x - b.x);
  const clusters: (typeof skus)[] = [];
  for (const s of byX) {
    const last = clusters[clusters.length - 1];
    if (last && s.x - last[last.length - 1].x <= 40) last.push(s);
    else clusters.push([s]);
  }
  const rowCount = (c: typeof skus) => new Set(c.map((s) => Math.round(s.y / 4))).size;
  const bestRows = Math.max(...clusters.map(rowCount));
  const chosen = clusters.find((c) => rowCount(c) >= Math.max(1, Math.ceil(bestRows / 2))) || clusters[0];
  const minX = Math.min(...chosen.map((s) => s.x));
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
 * Table catalogs draw every picture inside a bordered cell. Those borders (and
 * the colored header / note bars) would join all the drawings of the page into
 * one huge blob, so they are found and taken out of the ink mask first.
 *
 * A table rule is a horizontal run of ink that enters the picture strip from
 * the table on its right (it touches the strip's right edge), and a cell
 * border is a long vertical run that meets one of those rules. Drawings never
 * touch the table, so they are left alone. Returns null when the page has no
 * table rules (the usual case) and nothing was changed.
 */
function removeTableRules(ink: Uint8Array, w: number, h: number): Uint8Array | null {
  const rule = new Uint8Array(w * h);
  let lines = 0;
  let prevRow = -2;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    if (!ink[row + w - 1] && !ink[row + w - 2]) continue;
    let x = ink[row + w - 1] ? w - 1 : w - 2;
    while (x > 0 && (ink[row + x] || ink[row + x - 1])) x--;
    if (w - x < RULE_MIN_H) continue;
    for (let i = x; i < w; i++) rule[row + i] = 1;
    if (y - prevRow > 1) lines++;
    prevRow = y;
  }
  // Light-grey catalogs have no dark rules crossing the strip; the border and
  // frame clean-up below still applies to them.
  if (lines < 2) rule.fill(0);

  // The strip can run a little way into the table's first column, leaving that
  // column's left border (a long vertical line) and the stubs of its row lines
  // in the strip. Anything right of such a border is table, not picture.
  const edgeStart = Math.max(0, w - 30);
  for (let x = edgeStart; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (!ink[y * w + x]) {
        y++;
        continue;
      }
      const start = y;
      while (y < h && ink[y * w + x]) y++;
      if (y - start < RULE_MIN_V) continue;
      let stubRows = 0;
      let inStub = false;
      for (let r = start; r < y; r++) {
        const reaches = Boolean(ink[r * w + w - 1] || ink[r * w + w - 2]);
        if (reaches && !inStub) stubRows++;
        inStub = reaches;
      }
      if (stubRows < 2) continue;
      for (let r = start; r < y; r++) {
        for (let xx = x; xx < w; xx++) rule[r * w + xx] = 1;
      }
    }
  }

  // The picture cell's own outline: a vertical line taller than any drawing,
  // and the horizontal lines that start at it.
  const frameCols: number[] = [];
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (!ink[y * w + x]) {
        y++;
        continue;
      }
      const start = y;
      while (y < h && ink[y * w + x]) y++;
      if (y - start >= FRAME_MIN_V) {
        frameCols.push(x);
        for (let r = start; r < y; r++) rule[r * w + x] = 1;
      }
    }
  }
  if (frameCols.length > 0) {
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        if (!ink[y * w + x]) {
          x++;
          continue;
        }
        const start = x;
        while (x < w && ink[y * w + x]) x++;
        const touchesFrame = frameCols.some((fx) => fx >= start - 2 && fx <= x + 1);
        if (touchesFrame && x - start >= w * 0.6) {
          for (let c = start; c < x; c++) rule[y * w + c] = 1;
        }
      }
    }
  }

  // Cell borders: long vertical runs that meet one of the rules above.
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (!ink[y * w + x]) {
        y++;
        continue;
      }
      const start = y;
      let meets = false;
      while (y < h && ink[y * w + x]) {
        if (rule[y * w + x]) meets = true;
        y++;
      }
      if (meets && y - start >= RULE_MIN_V) {
        for (let r = start; r < y; r++) rule[r * w + x] = 1;
      }
    }
  }

  if (!rule.some((v) => v === 1)) return null;

  // Anti-aliased edges of those lines.
  const grown = new Uint8Array(rule);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rule[y * w + x] || !ink[y * w + x]) continue;
      for (let dy = -1; dy <= 1 && !grown[y * w + x]; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && rule[ny * w + nx]) {
            grown[y * w + x] = 1;
            break;
          }
        }
      }
    }
  }
  for (let i = 0; i < ink.length; i++) if (grown[i]) ink[i] = 0;
  return grown;
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
  // Same code, different spelling between the price list and the catalog
  // (B9 / B09, W30-30 / W3030): matched on the normalized form when there is
  // no exact match.
  const codeByNormalized = new Map<string, string>();
  for (const c of codes) {
    const key = c.trim().toLowerCase();
    // Prices/sizes are numbers; a real SKU has a letter and some length.
    if (key.length >= 3 && /[a-z]/.test(key)) codeByLower.set(key, c);
    const norm = normalizeCabinetCode(c);
    if (norm.length >= 2 && /[A-Z]/.test(norm) && /\d/.test(norm) && !codeByNormalized.has(norm)) {
      codeByNormalized.set(norm, c);
    }
  }
  if (codeByLower.size === 0 && codeByNormalized.size === 0) return { groups: [], pagesWithCodes: 0 };

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
        const code =
          codeByLower.get(b.str.toLowerCase()) ||
          (b.str.length <= 14 ? codeByNormalized.get(normalizeCabinetCode(b.str)) : undefined);
        if (code && !claimed.has(code.toLowerCase())) skus.push({ ...b, code });
      }
      const built = buildBlocks(skus);
      if (!built || built.blocks.length === 0) continue;
      pagesWithCodes++;

      // Left edge of the printed table = where the size/description text
      // that shares a row with the codes starts.
      const rows = skus.filter((s) => Math.abs(s.x - built.x) < 30).map((s) => s.y);
      // Text left of the codes on the same rows = the table's own columns. A
      // real column has text on most rows; a note or label that happens to sit
      // level with one or two codes (inside the picture area) is not a column.
      const leftBits = bits.filter(
        (b) =>
          !b.rotated &&
          b.x < built.x - 1 &&
          b.x > built.x - 200 &&
          rows.some((ry) => Math.abs(ry - b.y) < 3),
      );
      const needRows = rows.length <= 2 ? 1 : Math.max(2, Math.ceil(rows.length * 0.4));
      const tableTextXs = leftBits
        .filter((b) => {
          const coveredRows = new Set(
            leftBits
              .filter((o) => Math.abs(o.x - b.x) < 8)
              .map((o) => rows.findIndex((ry) => Math.abs(ry - o.y) < 3)),
          );
          return coveredRows.size >= needRows;
        })
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

      const tableRules = removeTableRules(ink, stripW, pageH);
      // Take the table's own rules out of the mask before looking for
      // pictures: a drawing whose dimension line or cell corner touches a rule
      // would otherwise fuse with the whole table grid and be thrown away.
      if (tableRules) {
        for (let i = 0; i < tableRules.length; i++) if (tableRules[i]) ink[i] = 0;
      }
      const { comps, labels } = findComponents(ink, stripW, pageH);
      const drawings: Comp[] = [];
      const small: Comp[] = [];
      for (const c of comps) {
        // Pieces of the table itself (note bars, cell corners) that run on
        // into the strip are not pictures.
        if (tableRules && c.x1 >= stripW - 2) continue;
        const w = c.x1 - c.x0 + 1;
        const h = c.y1 - c.y0 + 1;
        const density = c.count / (w * h);
        // Title bars are solid bands: a wide, short drawing (a drawer, a
        // molding, a wine rack) sitting beside a table is NOT one.
        const isTitleBar =
          w >= stripW * 0.5 &&
          h <= 90 &&
          density > 0.3 &&
          (density > 0.85 || c.y1 < firstBlockTop - 5);
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

      // One picture is sometimes several separate drawings side by side (a
      // 30"/36" cabinet next to the 42" one, a pair of doors). Drawings level
      // with each other and close together are one picture.
      {
        const parent = drawings.map((_, i) => i);
        const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
        for (let i = 0; i < drawings.length; i++) {
          for (let j = i + 1; j < drawings.length; j++) {
            const a = drawings[i];
            const b = drawings[j];
            const level = overlap(a.y0, a.y1, b.y0, b.y1);
            const shorter = Math.min(a.y1 - a.y0, b.y1 - b.y0) + 1;
            const gap = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));
            if (level >= shorter * 0.6 && gap <= SIDE_BY_SIDE_GAP) parent[find(j)] = find(i);
          }
        }
        const merged = new Map<number, Comp>();
        drawings.forEach((d, i) => {
          const root = find(i);
          const m = merged.get(root);
          if (!m) {
            merged.set(root, { ...d, ids: [d.id] });
          } else {
            m.x0 = Math.min(m.x0, d.x0);
            m.x1 = Math.max(m.x1, d.x1);
            m.y0 = Math.min(m.y0, d.y0);
            m.y1 = Math.max(m.y1, d.y1);
            m.count += d.count;
            m.ids!.push(d.id);
          }
        });
        drawings.length = 0;
        merged.forEach((m) => drawings.push(m));
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
            if ((label !== 0 && !included.has(label - 1)) || (tableRules && tableRules[y * stripW + x])) {
              cctx.fillRect((x - cx0) * SCALE, (y - cy0) * SCALE, SCALE, SCALE);
            }
          }
        }
        return Buffer.from(crop.toBuffer("image/png"));
      };

      for (const [drawing, drawingBlocks] of blocksByDrawing) {
        // Pull in the drawing's own labels (dimension text, ticks) - beside
        // the drawing and level with it, not above/below it.
        const included = new Set<number>(drawing.ids || [drawing.id]);
        let { x0, x1, y0, y1 } = drawing;
        for (const sm of small) {
          const near = (m: number) =>
            sm.x1 >= x0 - m && sm.x0 <= x1 + m && sm.y1 >= drawing.y0 - m && sm.y0 <= drawing.y1 + m;
          // Dimension text ("12\"", "30\" OR 24\"") belongs to the picture even
          // though each label is only a few dots of ink.
          const isLabel = labelBoxes.some(
            (l) => sm.x1 >= l.x0 - 2 && sm.x0 <= l.x1 + 2 && sm.y1 >= l.y0 - 2 && sm.y0 <= l.y1 + 2,
          );
          if (sm.x1 >= stripW - 3) continue; // a stub of the table's grid
          // A small SOLID block is a leftover bit of a table bar, not text.
          const smW = sm.x1 - sm.x0 + 1;
          const smH = sm.y1 - sm.y0 + 1;
          if (smW >= 4 && smH >= 12 && sm.count / (smW * smH) > 0.7) continue;
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

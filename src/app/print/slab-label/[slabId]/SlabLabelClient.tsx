"use client";

import QRCode from "react-qr-code";
import { useEffect, useState } from "react";

export type SlabLabelData = {
  id: string;
  scannerId: string;
  name: string;
  type: string;
  thickness: string;
  size: string;
  clientName: string;
  brand: string;
  finish: string;
  notes: string;
  jobId: string;
  rackId: string;
};

const TYPE_LABEL: Record<string, string> = {
  SLAB: "Slab",
  GMD: "GMD",
  REMNANT: "Remnant",
  RESERVED: "Reserved",
  CLIENT_SLAB: "Client Slab",
};

// ── Per-row "shrink, then wrap" sizing for long field values ────────────
//
// The value column has roughly this much usable text width once the label
// column, borders and cell padding are subtracted from the label's fixed
// 5.51in size (see the layout below). It's an estimate, not a live DOM
// measurement (there's no reliable way to measure real rendered text width
// before printing), tuned from the actual column widths in this file - if
// those change, this constant should move with them.
const VALUE_TEXT_WIDTH_PT = 117;
// Average glyph width for bold Arial, as a fraction of the font size. This
// is deliberately pessimistic (i.e. assumes narrower text fits per line
// than typically would): most of these fields (Providor, Finish, Notes/Job
// references, "DALTILE - QUARTZ" style values) are frequently all-caps and
// numeral-heavy, and those glyphs run noticeably wider in Arial Bold than
// the mixed-case prose an "average char width" is normally tuned for. An
// optimistic ratio here was the earlier bug: it under-counted how many
// lines a long value actually needed, so it still got cut off even after
// "wrapping" to what turned out to be too few lines.
const AVG_CHAR_WIDTH_RATIO = 0.66;
// Sizes tried, largest first, when a value doesn't fit at the base size.
const VALUE_FONT_STEPS = [12, 11, 10, 9, 8.5, 8];
// Hard cap on how many lines one row is allowed to grow to. A field that
// still doesn't fit at the smallest font size within this many lines is
// truncated with an ellipsis on the last line as a last resort, rather than
// letting one field consume the whole label.
const MAX_VALUE_LINES = 4;

function charsPerLine(fontSizePt: number) {
  return Math.max(1, Math.floor(VALUE_TEXT_WIDTH_PT / (fontSizePt * AVG_CHAR_WIDTH_RATIO)));
}

// Picks the largest font size (and fewest lines) a value can be shown at
// without being cut off, preferring to shrink the text before wrapping it,
// and only wrapping to more lines once the smallest font size still isn't
// enough. The row this is used for should grow to fit `lines` (see
// ROW_MIN_HEIGHT_PT below) so a multi-line value actually gets the extra
// height it needs instead of being clipped or pushed into the row below.
function getValueLayout(value: string): { fontSize: number; lines: number } {
  for (let lines = 1; lines <= MAX_VALUE_LINES; lines += 1) {
    for (const fontSize of VALUE_FONT_STEPS) {
      if (charsPerLine(fontSize) * lines >= value.length) {
        return { fontSize, lines };
      }
    }
  }
  // Nothing fit even at the smallest font size and the line cap - fall back
  // to the smallest size at the max line count; the ellipsis on the
  // component itself still keeps this from breaking the layout.
  return { fontSize: VALUE_FONT_STEPS[VALUE_FONT_STEPS.length - 1], lines: MAX_VALUE_LINES };
}

// Every row gets AT LEAST this much height no matter what, as a min-height
// floor alongside its proportional flexGrow share (see the row style
// below). Rows are still sized proportionally to how many lines they need
// - so a row that wrapped genuinely gets more room, and the section still
// fills the label edge-to-edge with no dead space when nothing wraps - but
// this floor stops a short, single-line row (Thickness, Size, Slab Type,
// ...) from ever being squeezed unreadably thin just because a sibling row
// next to it grew to 3-4 lines. ~14pt comfortably fits one line of the
// 9.6-12pt bold text used in these rows.
const ROW_MIN_HEIGHT_PT = 14;

export default function SlabLabelClient({ slab }: { slab: SlabLabelData }) {
  const [origin, setOrigin] = useState("");
  const [resolvedClientSubtitle, setResolvedClientSubtitle] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const qrUrl = origin ? `${origin}/slab/${slab.id}` : "";

  // Decode clientName (may contain "||" separator for GMD slabs)
  const sepIdx = slab.clientName.indexOf("||");
  const displayClient =
    sepIdx !== -1 ? slab.clientName.slice(0, sepIdx).trim() : slab.clientName;
  const originalClientName =
    sepIdx !== -1 ? slab.clientName.slice(sepIdx + 2).trim() : "";

  useEffect(() => {
    const normalizedClient = displayClient.trim();
    if (!normalizedClient) {
      setResolvedClientSubtitle("");
      return;
    }

    let active = true;
    fetch("/api/slab-rack-display/client-subtitles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: [normalizedClient] }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!active) return;
        const subtitles =
          payload && typeof payload === "object" && payload.subtitles
            ? (payload.subtitles as Record<string, string | null>)
            : {};
        setResolvedClientSubtitle(
          subtitles[normalizedClient.toLowerCase()]?.trim() || "",
        );
      })
      .catch(() => {
        if (!active) return;
        setResolvedClientSubtitle("");
      });

    return () => {
      active = false;
    };
  }, [displayClient]);

  const fallbackSubtitle = originalClientName
    ? `via ${originalClientName}`
    : "";
  const subtitleForLabel = resolvedClientSubtitle || fallbackSubtitle;
  const displayClientWithContractor = subtitleForLabel
    ? subtitleForLabel.toLowerCase().startsWith("via ")
      ? `${displayClient} ${subtitleForLabel}`
      : `${displayClient} (${subtitleForLabel})`
    : displayClient;

  const typeLabel = TYPE_LABEL[slab.type] ?? slab.type;

  const infoRows: Array<[string, string]> = [
    ["Scanner ID", slab.scannerId || "-"],
    ["Slab Name", slab.name || "-"],
    ["Providor", slab.brand || "-"],
    ["Finish", slab.finish || "-"],
    ["Thickness", slab.thickness || "-"],
    ["Size", slab.size || "-"],
    ["Client Name", displayClientWithContractor || "-"],
    ["Notes", slab.notes || "-"],
    ["Slab Type", typeLabel || "-"],
    ["Job ID", slab.jobId || "-"],
  ];

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          /* The label stock is a fixed 5.51 x 2.56in (matches the D2 Iris
             scanner's own label). Without an explicit page size here, the
             browser prints onto whatever paper size is currently selected
             (usually Letter/A4 by default) and then has to reconcile that
             mismatch by shifting/cropping the content - which is what was
             clipping the top edge of the label. Declaring the real size
             makes the printed page exactly match the physical label. */
          @page { size: 5.51in 2.56in; margin: 0; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }
          body > * {
            display: none !important;
          }
          .print-root {
            display: inline-block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            break-inside: avoid;
            page-break-inside: avoid;
            break-after: avoid-page;
            page-break-after: avoid;
          }
          .label-scale { transform: none !important; margin-bottom: 0 !important; }
        }
      `}</style>

      {/* Screen controls */}
      <div className="no-print flex flex-col items-center gap-3 py-8 bg-gray-100 min-h-screen">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow"
          >
            🖨️ Print Label
          </button>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 rounded-lg bg-white border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            ← Back
          </button>
        </div>
        <p className="text-xs text-gray-700 font-semibold">
          Print size: this page requests 5.51 x 2.56in automatically. If
          your print dialog shows a different paper size, switch it to
          match your label stock (5.51 x 2.56in) before printing.
        </p>

        {/* Screen preview — scaled up for readability */}
        <div
          className="label-scale"
          style={{
            transform: "scale(1.1)",
            transformOrigin: "top center",
            marginBottom: "4rem",
          }}
        >
          <LabelBody slab={slab} infoRows={infoRows} qrUrl={qrUrl} />
        </div>
      </div>

      {/* Print output */}
      <div className="hidden print:block print-root">
        <LabelBody slab={slab} infoRows={infoRows} qrUrl={qrUrl} />
      </div>
    </>
  );
}

function LabelBody({
  slab,
  infoRows,
  qrUrl,
}: {
  slab: SlabLabelData;
  infoRows: Array<[string, string]>;
  qrUrl: string;
}) {
  return (
    <div
      style={{
        // Pinned to the actual physical label size (5.51 x 2.56in), instead
        // of width: 100% and an implicit/content-driven height. Content that
        // used to overflow (e.g. a long Notes value) had nothing stopping it
        // from stretching this box wider/taller than the real label, which
        // is what made the printer's "fit to page" step shrink the entire
        // label - QR codes, borders and all - to cram it in. With an
        // explicit, fixed-size box + overflow: hidden, the label can never
        // render larger than the physical stock; an overlong field now gets
        // cleanly clipped in its own row instead of shrinking everything.
        width: "5.51in",
        height: "2.56in",
        display: "flex",
        flexDirection: "row",
        fontFamily: "Arial, Helvetica, sans-serif",
        backgroundColor: "#ffffff",
        border: "2px solid #000000",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* ── Tear-off strip: 1" wide on the LEFT ──────────────────── */}
      <div
        style={{
          width: "1in",
          flexShrink: 0,
          // No explicit height here anymore - it stretches (the flex row's
          // default align-items: stretch) to match the parent's now-fixed
          // 2.56in height, so there's a single source of truth for the
          // label's height instead of two slightly different numbers.
          borderRight: "2px dashed #111111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          backgroundColor: "#ffffff",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) rotate(-90deg)",
            width: "2.35in",
            height: "0.94in",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "8pt",
          }}
        >
          {qrUrl ? (
            <QRCode
              value={qrUrl}
              style={{ width: "0.74in", height: "0.74in", flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: "0.74in",
                height: "0.74in",
                flexShrink: 0,
                backgroundColor: "#eee",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "6pt",
                color: "#000",
                fontWeight: "bold",
              }}
            >
              QR
            </div>
          )}

          <div
            style={{
              flex: 1,
              // Same minWidth: 0 fix as the main info rows: this text
              // column sits next to the fixed-size QR code inside a
              // *fixed*-size (2.35in x 0.94in) absolutely-positioned box,
              // which doesn't grow for anything. Without minWidth: 0, a
              // long scanner ID/name here couldn't shrink to fit next to
              // the QR code, so it overflowed sideways past that fixed
              // box and got clipped by the strip's overflow: hidden -
              // this is the "cuts the scanner id" symptom.
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              overflow: "hidden",
              gap: "2pt",
            }}
          >
            <div
              style={{
                fontSize: "8.5pt",
                fontWeight: "bold",
                color: "#000",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {slab.scannerId || slab.id}
            </div>
            <div
              style={{
                fontSize: "7pt",
                fontWeight: "bold",
                color: "#000",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {slab.name}
            </div>
            {slab.thickness && (
              <div
                style={{
                  fontSize: "6.5pt",
                  fontWeight: "bold",
                  color: "#000",
                  whiteSpace: "nowrap",
                }}
              >
                T: {slab.thickness}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main info section: 6.5" wide ─────────────────────────── */}
      <div
        style={{
          flex: 1,
          // minWidth: 0 keeps this section from being forced wider than its
          // share of the label by an oversized descendant (see the grid
          // column and value-cell notes below) - the classic flexbox "1fr
          // item won't shrink past its content" trap.
          minWidth: 0,
          display: "grid",
          // minmax(0, 1fr) instead of a bare 1fr: a bare 1fr grid track
          // still refuses to shrink below the intrinsic (unwrapped) width of
          // its content, so one long value (e.g. a long Notes field) could
          // stretch this whole column - and with it the whole label - wider
          // than the physical stock. minmax(0, ...) lets the track actually
          // shrink to the space available, so long text is clipped by the
          // ellipsis below instead of blowing out the layout.
          gridTemplateColumns: "1.5in minmax(0, 1fr)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "6pt",
            padding: "8pt 8pt 8pt 10pt",
            borderRight: "2px solid #000000",
            backgroundColor: "#ffffff",
          }}
        >
          {qrUrl ? (
            <QRCode
              value={qrUrl}
              style={{ width: "1.22in", height: "1.22in", flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: "1.22in",
                height: "1.22in",
                backgroundColor: "#eee",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "8pt",
                color: "#000",
                fontWeight: "bold",
              }}
            >
              QR
            </div>
          )}
          <div
            style={{
              fontSize: "10pt",
              fontWeight: "bold",
              color: "#000",
              textAlign: "center",
              lineHeight: 1.15,
            }}
          >
            SCAN FOR
            <br />
            SLAB DETAILS
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {infoRows.map(([label, value], idx) => {
              // Shrink the value's font size first; only once it can't get
              // any smaller does it wrap onto more lines. `lines` then also
              // drives this row's own height below (flexGrow, with a
              // minHeight floor), so a row that needed to wrap actually
              // gets more height instead of just running out of room.
              const { fontSize, lines } = getValueLayout(value);
              return (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    borderTop: idx > 0 ? "1.5px solid #000000" : "none",
                    // flexGrow: lines + flexBasis: 0 divides 100% of the
                    // available height proportionally by line count (so the
                    // rows always fill the label edge-to-edge, with no dead
                    // space when nothing wraps), while minHeight is a hard
                    // floor the flex algorithm still respects even when a
                    // sibling row's growth would otherwise squeeze this one
                    // thinner - the fix for a short row (e.g. Slab Type)
                    // getting crushed right after a row that wrapped.
                    flexGrow: lines,
                    flexShrink: 1,
                    flexBasis: 0,
                    minHeight: `${ROW_MIN_HEIGHT_PT}pt`,
                  }}
                >
                  <div
                    style={{
                      width: "74pt",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      padding: "0 5pt",
                      backgroundColor: "#ffffff",
                      borderRight: "1.5px solid #000000",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "9.6pt",
                        fontWeight: "bold",
                        color: "#000",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      // Same minWidth: 0 fix as above, at the row level: this
                      // is the cell that actually holds a field's value, so
                      // it's the one a long Notes/Client/Providor value would
                      // otherwise stretch past its allotted width.
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      padding: "0 10pt",
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        // flex: 1 + minWidth: 0 gives this span an actual
                        // bounded box to wrap/clip against - a bare <span>
                        // sizes to its text content by default.
                        flex: 1,
                        minWidth: 0,
                        fontSize: `${fontSize}pt`,
                        fontWeight: "bold",
                        color: "#000",
                        lineHeight: 1.15,
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                        overflowWrap: "break-word",
                        // Hard cap at `lines` lines with an ellipsis on the
                        // last one - belt-and-suspenders for the rare value
                        // that's still too long even at the smallest font
                        // size and the max line count (getValueLayout's
                        // fallback case), so it clips instead of pushing
                        // into the next row.
                        display: "-webkit-box",
                        WebkitLineClamp: lines,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

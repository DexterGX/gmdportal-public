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

export default function SlabLabelClient({ slab }: { slab: SlabLabelData }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const qrUrl = origin ? `${origin}/slab/${slab.id}` : "";

  // Decode clientName (may contain "||" separator for GMD slabs)
  const sepIdx = slab.clientName.indexOf("||");
  const displayClient =
    sepIdx !== -1 ? slab.clientName.slice(0, sepIdx) : slab.clientName;

  const typeLabel = TYPE_LABEL[slab.type] ?? slab.type;

  const infoRows: Array<[string, string]> = [
    ["Scanner ID", slab.scannerId],
    ["Slab Name", slab.name],
    ["Provider", slab.brand],
    ["Finish", slab.finish],
    ["Thickness", slab.thickness],
    ["Client Name", displayClient],
    ["Slab Type", typeLabel],
    ["Job ID", slab.jobId],
    ["Notes", slab.notes],
  ].filter(([, v]) => Boolean(v)) as Array<[string, string]>;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: 7.5in 2.5in; margin: 0; }
          body { margin: 0; padding: 0; background: white; }
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
        <p className="text-xs text-gray-500">
          Label size: 7.5&quot; × 2.5&quot; &middot; Right 1&quot; is a tear-off
          strip for slab edge
        </p>

        {/* Screen preview — scaled up for readability */}
        <div
          className="label-scale"
          style={{
            transform: "scale(1.5)",
            transformOrigin: "top center",
            marginBottom: "4rem",
          }}
        >
          <LabelBody slab={slab} infoRows={infoRows} qrUrl={qrUrl} />
        </div>
      </div>

      {/* Print output */}
      <div className="hidden print:block">
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
        width: "7.5in",
        height: "2.5in",
        display: "flex",
        flexDirection: "row",
        fontFamily: "Arial, Helvetica, sans-serif",
        backgroundColor: "#ffffff",
        border: "1px solid #cccccc",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* ── Main info section: 6.5" wide ─────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header bar */}
        <div
          style={{
            padding: "6pt 10pt 5pt",
            borderBottom: "1.5px solid #1a56db",
            backgroundColor: "#f0f4ff",
          }}
        >
          <span
            style={{
              fontSize: "9pt",
              fontWeight: "bold",
              color: "#1a56db",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            GMD Portal — Slab Label
          </span>
        </div>

        {/* Info rows with dividers */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {infoRows.map(([label, value], idx) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "stretch",
                borderBottom:
                  idx < infoRows.length - 1 ? "1px solid #e0e0e0" : "none",
                flex: 1,
                minHeight: 0,
              }}
            >
              {/* Label cell */}
              <div
                style={{
                  width: "76pt",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  padding: "0 6pt",
                  backgroundColor: "#f8f8f8",
                  borderRight: "1px solid #ddd",
                }}
              >
                <span
                  style={{
                    fontSize: "7.5pt",
                    fontWeight: "bold",
                    color: "#444",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
              </div>
              {/* Value cell */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 8pt",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    fontSize: "8.5pt",
                    color: "#111",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tear-off strip: 1" wide on the RIGHT ─────────────────── */}
      <div
        style={{
          width: "1in",
          flexShrink: 0,
          height: "2.5in",
          borderLeft: "2px dashed #aaaaaa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          backgroundColor: "#fafafa",
          position: "relative",
        }}
      >
        {/*
          The inner container is rotated -90deg.
          Its natural dimensions: width=2.3in, height=0.88in
          After rotation it becomes visually 0.88in wide × 2.3in tall,
          which fits inside the 1in × 2.5in strip.
        */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) rotate(-90deg)",
            width: "2.35in",
            height: "0.9in",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "6pt",
          }}
        >
          {/* QR code on the strip */}
          {qrUrl ? (
            <QRCode
              value={qrUrl}
              style={{ width: "0.72in", height: "0.72in", flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: "0.72in",
                height: "0.72in",
                flexShrink: 0,
                backgroundColor: "#eee",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "5pt",
                color: "#999",
              }}
            >
              QR
            </div>
          )}

          {/* Text next to QR */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              overflow: "hidden",
              gap: "1.5pt",
            }}
          >
            <div
              style={{
                fontSize: "7.5pt",
                fontWeight: "bold",
                color: "#111",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {slab.scannerId || slab.id}
            </div>
            <div
              style={{
                fontSize: "6.5pt",
                color: "#333",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {slab.name}
            </div>
            {slab.thickness && (
              <div
                style={{ fontSize: "6pt", color: "#666", whiteSpace: "nowrap" }}
              >
                T: {slab.thickness}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

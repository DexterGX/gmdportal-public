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
    ["Scanner ID", slab.scannerId || "-"],
    ["Slab Name", slab.name || "-"],
    ["Providor", slab.brand || "-"],
    ["Finish", slab.finish || "-"],
    ["Thickness", slab.thickness || "-"],
    ["Client Name", displayClient || "-"],
    ["Notes", slab.notes || "-"],
    ["Slab Type", typeLabel || "-"],
    ["Job ID", slab.jobId || "-"],
  ];

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 0; }
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
        <p className="text-xs text-gray-700 font-semibold">
          Print size: using your printer driver default stock size
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
        width: "100%",
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
          height: "2.5in",
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
          display: "grid",
          gridTemplateColumns: "1.5in 1fr",
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
            {infoRows.map(([label, value], idx) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  borderBottom:
                    idx < infoRows.length - 1 ? "1.5px solid #000000" : "none",
                  flex: 1,
                  minHeight: 0,
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
                    display: "flex",
                    alignItems: "center",
                    padding: "0 10pt",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12pt",
                      fontWeight: "bold",
                      color: "#000",
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
      </div>
    </div>
  );
}

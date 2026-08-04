import { notFound, redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/fabricationCalc";
import PrintButton from "./PrintButton";

const prismaAny = prisma as any;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const THICKNESS_LABELS: Record<string, string> = {
  EIGHT_MM: "8mm",
  TWELVE_MM: "12mm",
  TWO_CM: "2cm",
  THREE_CM: "3cm",
  FIFTEEN_MM: "15mm",
};

function ShapeSvg({ shapes }: { shapes: any[] }) {
  if (!Array.isArray(shapes) || shapes.length === 0) return null;
  return (
    <svg viewBox="0 0 760 440" className="w-full max-w-xl rounded-md border border-gray-300 bg-white">
      {shapes.map((shape, idx) => {
        if (shape.type === "path" && Array.isArray(shape.points)) {
          const d = shape.points
            .map((p: any, i: number) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
            .join(" ");
          return <path key={idx} d={d} stroke={shape.color} strokeWidth={2} fill="none" />;
        }
        if (shape.type === "rect") {
          return (
            <rect
              key={idx}
              x={shape.x}
              y={shape.y}
              width={shape.w}
              height={shape.h}
              stroke={shape.color}
              strokeWidth={2}
              fill="none"
            />
          );
        }
        if (shape.type === "line") {
          return (
            <line
              key={idx}
              x1={shape.x1}
              y1={shape.y1}
              x2={shape.x2}
              y2={shape.y2}
              stroke={shape.color}
              strokeWidth={2}
            />
          );
        }
        if (shape.type === "text") {
          return (
            <text key={idx} x={shape.x} y={shape.y} fill={shape.color} fontSize={14}>
              {shape.text}
            </text>
          );
        }
        return null;
      })}
    </svg>
  );
}

export default async function FabricationOrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive) {
    redirect("/login");
  }

  const { id } = await params;

  const order = await prismaAny.fabricationOrder.findUnique({
    where: { id },
    include: {
      areas: {
        orderBy: { sortOrder: "asc" },
        include: {
          sections: { orderBy: { sortOrder: "asc" }, include: { rows: { orderBy: { sortOrder: "asc" } } } },
          images: true,
          slabSupplier: { select: { name: true } },
          slabType: { select: { name: true } },
          sinkTypeOption: { select: { name: true } },
          sinkCutoutOption: { select: { name: true } },
          cooktopOption: { select: { name: true } },
          bumpOutOption: { select: { name: true } },
          cuttingBoardOption: { select: { name: true } },
          windowsillOption: { select: { name: true } },
          powerStationOption: { select: { name: true } },
          otherChargeOption: { select: { name: true } },
          removalOption: { select: { name: true } },
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 bg-white p-2 print:p-0">
      <div className="print:hidden">
        <PrintButton />
      </div>

      <div className="flex items-start justify-between border-b border-gray-300 pb-3">
        <div>
          <h1 className="text-xl font-bold">GM Design - Fabrication Order</h1>
          <p className="text-sm text-gray-600">Client: {order.clientName}</p>
          <p className="text-sm text-gray-600">Sales Rep: {order.salesRep}</p>
        </div>
        <div className="text-right text-sm text-gray-600">
          <p>Order #{order.orderNumber || order.id.slice(0, 8).toUpperCase()}</p>
          <p>{new Date(order.date || order.createdAt).toLocaleDateString()}</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(toNumber(order.total))}</p>
        </div>
      </div>

      {order.areas.map((area: any) => (
        <div key={area.id} className="break-inside-avoid space-y-3 border border-gray-300 p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{area.name}</h2>
            <span className="text-lg font-bold">{formatCurrency(toNumber(area.areaTotal))}</span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700 md:grid-cols-4">
            <div>
              Sink Type: {area.sinkTypeOption?.name || "None"}
              {area.sinkTypeText ? ` — Model: ${area.sinkTypeText}` : ""}
              {area.sinkQty ? ` (Qty ${area.sinkQty})` : ""}
            </div>
            <div>Faucet: {area.faucetText || "-"}</div>
            <div>
              Stone: {area.stoneName || "-"}{" "}
              {area.stoneThickness ? THICKNESS_LABELS[area.stoneThickness] || area.stoneThickness : ""}
            </div>
            <div>WH#: {area.whNumber || "-"}</div>
            <div>Slab Supplier: {area.slabSupplier?.name || area.slabSupplierCustomName || "-"}</div>
            <div>Slab Area: {area.slabAreaLabel || "-"}</div>
            <div>Slab Qty: {area.slabQty} (recommended {area.slabRecommendedQty})</div>
            <div>Slab Type: {area.slabType?.name || "-"}</div>
            <div>Backsplash: {area.backsplashHas ? `${toNumber(area.backsplashIn)} in` : "No"}</div>
          </div>

          {area.sections.map((section: any) => (
            <table key={section.id} className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                  <th className="py-1 pr-2">Length</th>
                  <th className="py-1 pr-2">Width</th>
                  <th className="py-1 pr-2">SqFt</th>
                  <th className="py-1 pr-2">Edge Type</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row: any) => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="py-1 pr-2">{toNumber(row.lengthIn)}</td>
                    <td className="py-1 pr-2">{toNumber(row.widthIn)}</td>
                    <td className="py-1 pr-2">{toNumber(row.sqft).toFixed(2)}</td>
                    <td className="py-1 pr-2">-</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700 md:grid-cols-4">
            <div>Job SqFt: {toNumber(area.jobSqft).toFixed(2)}</div>
            <div>Labor: {formatCurrency(toNumber(area.labor))}</div>
            <div>Build-Up: {formatCurrency(toNumber(area.buildUp))}</div>
            <div>
              Sink Cutout ({area.sinkCutoutOption?.name || "-"} x{area.sinkCutoutQty}):{" "}
              {formatCurrency(toNumber(area.sinkCutoutTotal))}
            </div>
            <div>
              Cooktop ({area.cooktopOption?.name || "-"} x{area.cooktopQty}):{" "}
              {formatCurrency(toNumber(area.cooktopTotal))}
            </div>
            <div>
              Bump Out ({area.bumpOutOption?.name || "-"} x{area.bumpOutQty}):{" "}
              {formatCurrency(toNumber(area.bumpOutTotal))}
            </div>
            <div>
              Cutting Board ({area.cuttingBoardOption?.name || "-"} x{area.cuttingBoardQty}):{" "}
              {formatCurrency(toNumber(area.cuttingBoardTotal))}
            </div>
            <div>Windowsill ({area.windowsillOption?.name || "-"}): {formatCurrency(toNumber(area.windowsillTotal))}</div>
            <div>Power Station ({area.powerStationOption?.name || "-"}): {formatCurrency(toNumber(area.powerStationTotal))}</div>
            <div>
              Others ({area.otherChargeOption?.name || area.otherChargeCustomName || "-"}):{" "}
              {formatCurrency(toNumber(area.otherChargeTotal))}
            </div>
            <div>Removal ({area.removalOption?.name || "-"}): {formatCurrency(toNumber(area.removalTotal))}</div>
            <div>Slab Amount: {formatCurrency(toNumber(area.slabAmount))}</div>
            {area.leftoverNote && area.leftoverNote !== "None" && (
              <div>Leftover: {area.leftoverNote}</div>
            )}
          </div>

          {area.drawingMode === "IMAGE" && area.images.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {area.images.map((img: any) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.id}
                  src={img.fileUrl}
                  alt={img.caption || area.name}
                  className="h-48 w-auto rounded-md border border-gray-300 object-contain"
                />
              ))}
            </div>
          ) : (
            <ShapeSvg shapes={area.canvasData?.shapes || []} />
          )}
        </div>
      ))}

      {order.notes && (
        <div className="text-sm text-gray-700">
          <strong>Notes:</strong> {order.notes}
        </div>
      )}
    </div>
  );
}

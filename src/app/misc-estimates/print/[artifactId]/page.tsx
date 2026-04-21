import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import AutoPrintClient from "./AutoPrintClient";

const prismaAny = prisma as any;

type Meta = {
  estimateNumber?: string;
  title?: string;
  customerName?: string;
  customerPipedriveId?: string | null;
  dealName?: string | null;
  address?: string | null;
  contractor?: string | null;
  date?: string;
  salesRep?: string;
  selectedOptions?: string[];
  ledStripRows?: Array<{
    room?: string;
    lnFt?: number | null;
    ledType?: string;
    controlType?: string;
    profile?: string;
    profileQty?: number | null;
    subtotal?: number | null;
  }>;
  ledStripSubtotal?: number;
};

const SECTION_LABELS: Record<string, string> = {
  LED_STRIP: "LED Strip",
  LED_SHEET: "LED Sheet",
  MIRROR: "Mirror",
  GLASS_DOOR_SHELF: "Glass Door/Shelf",
  ISLAND_PANEL: "Island Panel",
  WALL_UNIT: "Wall Unit",
  MIRROR_FRAME: "Mirror Frame",
};

function fmtNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return String(value);
}

export default async function MiscEstimatePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ artifactId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (!["admin", "sales", "office"].includes(appRole)) {
    redirect("/dashboard");
  }

  const { artifactId } = await params;
  const query = await searchParams;
  const shouldAutoPrint = query.autoprint === "1";

  const artifact = await prisma.jobArtifact.findFirst({
    where: {
      id: artifactId,
      sourceApp: "MISC_ESTIMATE",
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  if (!artifact) {
    notFound();
  }

  const meta = ((artifact.metadata ?? {}) as Meta) || {};
  const companySettings = await prismaAny.companyDocumentSettings.findFirst();

  const rows = Array.isArray(meta.ledStripRows) ? meta.ledStripRows : [];
  const paddedRows = [...rows];
  while (paddedRows.length < 4) {
    paddedRows.push({});
  }

  const selected = Array.isArray(meta.selectedOptions)
    ? meta.selectedOptions
    : [];

  return (
    <div className="bg-gray-50 min-h-screen p-6 print:p-0 print:bg-white">
      {shouldAutoPrint && <AutoPrintClient />}
      <div id="print-area" className="misc-estimate-print space-y-1">
        <section className="misc-print-block bg-white border border-gray-200 rounded-xl p-5 print:border print:border-gray-900 print:rounded-none print:p-2">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 print:grid-cols-12 print:gap-2 items-stretch">
            <div className="lg:col-span-7 print:col-span-8 border border-gray-300 rounded-lg p-4 print:border-gray-900 print:p-2">
              <div className="flex gap-4 items-stretch min-h-[118px]">
                <div className="w-48 h-auto relative bg-white rounded border border-gray-200 overflow-hidden flex-shrink-0">
                  <img
                    src={companySettings?.logoUrl || "/logo.svg"}
                    alt={companySettings?.companyName || "GM Design"}
                    className="w-full h-full object-contain p-2"
                  />
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-xl font-semibold text-gray-900">
                    {companySettings?.companyName || "GM Design"}
                  </p>
                  <p className="text-sm text-gray-700">
                    {companySettings?.phoneNumber || "-"}
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {companySettings?.address || "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 print:col-span-4 border border-gray-300 rounded-lg p-4 print:border-gray-900 print:p-2 space-y-3 print:space-y-2">
              <div className="grid grid-cols-2 gap-3 print:gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Estimate #
                  </label>
                  <input
                    value={meta.estimateNumber || ""}
                    readOnly
                    className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Date
                  </label>
                  <input
                    value={meta.date || ""}
                    readOnly
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Sales Rep
                </label>
                <input
                  value={meta.salesRep || ""}
                  readOnly
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="misc-print-block bg-white border border-gray-200 rounded-xl p-5 print:border print:border-gray-900 print:rounded-none print:p-2">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 print:grid-cols-12 print:gap-2">
            <div className="lg:col-span-4 space-y-3 print:space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Title
                </label>
                <input
                  value={meta.title || "Miscellaneous Estimate"}
                  readOnly
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Client (PD ID, Name, Deal, Address, Contractor)
                </label>
                <input
                  value={meta.customerName || "-"}
                  readOnly
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="print:col-span-4 border border-gray-900 rounded-none p-2 bg-white">
              <p className="text-sm font-semibold text-gray-900 mb-2">
                Client Info
              </p>
              <div className="space-y-1.5 text-sm text-gray-900">
                <p>
                  <span className="font-semibold">Client PD ID:</span>{" "}
                  {meta.customerPipedriveId || "-"}
                </p>
                <p>
                  <span className="font-semibold">Client Name:</span>{" "}
                  {meta.customerName || "-"}
                </p>
                <p>
                  <span className="font-semibold">Deal:</span>{" "}
                  {meta.dealName || "-"}
                </p>
                <p>
                  <span className="font-semibold">Address:</span>{" "}
                  {meta.address || "-"}
                </p>
                <p>
                  <span className="font-semibold">Contractor:</span>{" "}
                  {meta.contractor || "-"}
                </p>
              </div>
            </div>

            <div className="lg:col-span-4 print:col-span-4 border border-gray-300 rounded-lg p-3 print:border-gray-900 print:p-2">
              <p className="text-sm font-semibold text-gray-800 mb-2">
                Estimate Sections
              </p>
              <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                {Object.entries(SECTION_LABELS).map(([key, label]) => (
                  <label
                    key={key}
                    className="inline-flex items-center gap-2 text-sm text-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(key)}
                      readOnly
                      className="rounded border-gray-400"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {selected.includes("LED_STRIP") && (
          <section className="misc-print-block misc-print-flow bg-white border border-gray-200 rounded-xl overflow-hidden print:border print:border-gray-900 print:rounded-none">
            <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold">
              LED STRIP
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse print:min-w-0">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold">
                      Room
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold">
                      Ln.Ft.
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold">
                      LED Type
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold">
                      Control Type
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold">
                      Profile
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold">
                      Profile Qty
                    </th>
                    <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paddedRows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="border border-gray-300 p-1">
                        <input
                          value={row.room || ""}
                          readOnly
                          className="w-full bg-transparent px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          value={fmtNumber(row.lnFt)}
                          readOnly
                          className="w-full bg-transparent px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          value={row.ledType || ""}
                          readOnly
                          className="w-full bg-transparent px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          value={row.controlType || ""}
                          readOnly
                          className="w-full bg-transparent px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          value={row.profile || ""}
                          readOnly
                          className="w-full bg-transparent px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          value={fmtNumber(row.profileQty)}
                          readOnly
                          className="w-full bg-transparent px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="border border-gray-300 p-1">
                        <input
                          value={fmtNumber(row.subtotal)}
                          readOnly
                          className="w-full bg-transparent px-2 py-1 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="border border-gray-300 p-2" colSpan={6} />
                    <td className="border border-gray-300 px-2 py-2 text-right font-semibold text-sm">
                      $
                      {(typeof meta.ledStripSubtotal === "number"
                        ? meta.ledStripSubtotal
                        : 0
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

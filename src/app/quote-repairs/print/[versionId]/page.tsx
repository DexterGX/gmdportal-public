import { notFound, redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import {
  formatQuoteRepairAreas,
  formatUsd,
  formatUsPhone,
} from "@/lib/quoteRepairs";
import AutoPrintClient from "./AutoPrintClient";

export default async function QuoteRepairPrintPage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const { versionId } = await params;
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (!["admin", "sales", "office", "finance"].includes(appRole)) {
    redirect("/dashboard");
  }

  const version = await prisma.quoteRepairVersion.findUnique({
    where: { id: versionId },
    include: {
      quoteRepair: {
        include: {
          salesRep: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      },
      items: { orderBy: { sortOrder: "asc" }, include: { service: true } },
    },
  });

  if (!version) notFound();

  const repair = version.quoteRepair;
  const settings = await prisma.quoteRepairSettings.findFirst();

  return (
    <div className="quote-print-layout bg-white text-black p-6 print:p-0 print:bg-white print:min-h-0">
      <AutoPrintClient />
      <div className="max-w-[8.5in] mx-auto space-y-5 print:space-y-4">
        <section className="border border-gray-900 p-5 print:border-black">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <img
                src="/logo.svg"
                alt="GM Design"
                className="w-28 h-28 object-contain"
              />
              <h1 className="text-2xl font-bold">GM Design</h1>
            </div>
            <div className="text-sm space-y-1 text-right">
              <p>
                <span className="font-semibold">QR #:</span>{" "}
                {repair.quoteRepairNumber}
              </p>
              <p>
                <span className="font-semibold">Version #:</span>{" "}
                {version.versionNumber}
              </p>
              <p>
                <span className="font-semibold">Sales Rep:</span>{" "}
                {repair.salesRep?.name || repair.salesRep?.email || "-"}
              </p>
              <p>
                <span className="font-semibold">Status:</span>{" "}
                {version.status}
              </p>
            </div>
          </div>
        </section>

        <section className="border border-gray-900 p-4 print:border-black text-sm">
          <div className="space-y-1">
            <p className="font-semibold">Customer Information</p>
            <p>
              <span className="font-semibold">Customer:</span>{" "}
              {repair.customerName}
            </p>
            <p>
              <span className="font-semibold">Phone:</span>{" "}
              {formatUsPhone(repair.customerPhone) || "-"}
            </p>
            <p>
              <span className="font-semibold">Address:</span>{" "}
              {repair.propertyAddress}
            </p>
            <p>
              <span className="font-semibold">Contractor:</span>{" "}
              {repair.contractor || "-"}
            </p>
            <p>
              <span className="font-semibold">Areas:</span>{" "}
              {formatQuoteRepairAreas(repair.areas)}
            </p>
          </div>
        </section>

        <section className="border border-gray-900 print:border-black">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-900 px-2 py-2 text-left text-sm">
                  #
                </th>
                <th className="border border-gray-900 px-2 py-2 text-left text-sm">
                  Service
                </th>
                <th className="border border-gray-900 px-2 py-2 text-left text-sm">
                  Description
                </th>
                <th className="border border-gray-900 px-2 py-2 text-left text-sm">
                  Price
                </th>
              </tr>
            </thead>
            <tbody>
              {version.items.map((item, index) => (
                <tr key={item.id}>
                  <td className="border border-gray-900 align-top px-2 py-2">
                    {index + 1}
                  </td>
                  <td className="border border-gray-900 align-top px-2 py-2">
                    {item.serviceNameSnapshot}
                  </td>
                  <td className="border border-gray-900 align-top px-2 py-2 whitespace-pre-wrap break-words">
                    {item.description}
                  </td>
                  <td className="border border-gray-900 align-top px-2 py-2 whitespace-nowrap">
                    {item.price
                      ? formatUsd(item.price as unknown as number)
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td
                  colSpan={3}
                  className="border border-gray-900 px-2 py-2 text-right font-semibold"
                >
                  Total Amount
                </td>
                <td className="border border-gray-900 px-2 py-2 whitespace-nowrap font-semibold">
                  {formatUsd(version.total as unknown as number)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="border border-gray-900 p-4 print:border-black text-sm space-y-4">
          <div>
            <p className="font-semibold mb-1">Customer Notes</p>
            <p className="whitespace-pre-wrap break-words">
              {version.customerNotes || settings?.defaultCustomerTerms || ""}
            </p>
          </div>
          <div className="pt-2">
            <div className="border-t border-gray-500 w-[92%] mx-auto" />
          </div>
          <div className="pt-8 text-sm space-y-5">
            <p>
              {settings?.authorizationText ||
                "I, ______________________________, authorize the charge amount of $____________ for the services described above."}
            </p>
            <p>
              {settings?.hoaPermitNote ||
                "HOA approval and permit are the customer's responsibility when applicable."}
            </p>
            <div className="grid grid-cols-3 gap-4 pt-6">
              <div className="border-t border-gray-900 pt-1">
                Customer Signature
              </div>
              <div className="border-t border-gray-900 pt-1">Printed Name</div>
              <div className="border-t border-gray-900 pt-1">Date</div>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 0.45in;
          }

          .quote-print-layout {
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

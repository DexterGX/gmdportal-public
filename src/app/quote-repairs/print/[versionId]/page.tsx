import { notFound, redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { formatQuoteRepairAreas, QUOTE_REPAIR_STATUS_LABELS } from "@/lib/quoteRepairs";

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
  if (version.status !== "APPROVED") {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-2">Quote Repair Print</h1>
        <p className="text-gray-600">This version is not approved yet.</p>
      </div>
    );
  }

  const repair = version.quoteRepair;
  const settings = await prisma.quoteRepairSettings.findFirst();

  return (
    <div className="quote-print-layout bg-white text-black min-h-screen p-6 print:p-0">
      <div className="max-w-[8.5in] mx-auto space-y-4 print:space-y-3">
        <section className="border border-gray-900 p-4 print:border-black">
          <div className="grid grid-cols-12 gap-3 items-start">
            <div className="col-span-7">
              <div className="flex items-start gap-4">
                <img src="/logo.svg" alt="GM Design" className="w-20 h-20 object-contain" />
                <div>
                  <h1 className="text-2xl font-bold">GM Design</h1>
                  <p className="text-sm">Quote Repair</p>
                  <p className="text-sm">{repair.quoteRepairNumber}</p>
                </div>
              </div>
            </div>
            <div className="col-span-5 text-sm space-y-1">
              <p><span className="font-semibold">Version:</span> {version.versionNumber}</p>
              <p><span className="font-semibold">Date:</span> {new Date(version.approvedAt || version.createdAt).toLocaleDateString()}</p>
              <p><span className="font-semibold">Sales Rep:</span> {repair.salesRep?.name || repair.salesRep?.email || "-"}</p>
              <p><span className="font-semibold">Status:</span> {QUOTE_REPAIR_STATUS_LABELS[version.status]}</p>
            </div>
          </div>
        </section>

        <section className="border border-gray-900 p-4 print:border-black text-sm space-y-1">
          <p><span className="font-semibold">Customer:</span> {repair.customerName}</p>
          <p><span className="font-semibold">Phone:</span> {repair.customerPhone || "-"}</p>
          <p><span className="font-semibold">Address:</span> {repair.propertyAddress}</p>
          <p><span className="font-semibold">Contractor:</span> {repair.contractor || "-"}</p>
          <p><span className="font-semibold">Areas:</span> {formatQuoteRepairAreas(repair.areas)}</p>
        </section>

        <section className="border border-gray-900 print:border-black">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-900 px-2 py-2 text-left text-sm">#</th>
                <th className="border border-gray-900 px-2 py-2 text-left text-sm">Service</th>
                <th className="border border-gray-900 px-2 py-2 text-left text-sm">Description</th>
                <th className="border border-gray-900 px-2 py-2 text-left text-sm">Price</th>
              </tr>
            </thead>
            <tbody>
              {version.items.map((item, index) => (
                <tr key={item.id}>
                  <td className="border border-gray-900 align-top px-2 py-2">{index + 1}</td>
                  <td className="border border-gray-900 align-top px-2 py-2">{item.serviceNameSnapshot}</td>
                  <td className="border border-gray-900 align-top px-2 py-2 whitespace-pre-wrap break-words">{item.description}</td>
                  <td className="border border-gray-900 align-top px-2 py-2 whitespace-nowrap">{item.price ? `$${Number(item.price).toFixed(2)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="border border-gray-900 p-4 print:border-black text-sm space-y-3">
          <div>
            <p className="font-semibold mb-1">Customer Notes</p>
            <p className="whitespace-pre-wrap break-words">{version.customerNotes || settings?.defaultCustomerTerms || ""}</p>
          </div>
          <div className="flex items-center justify-between gap-3 text-base font-semibold">
            <span>Total Amount</span>
            <span>${Number(version.total).toFixed(2)}</span>
          </div>
          <div className="pt-2 text-sm space-y-4">
            <p>{settings?.authorizationText || "I, ______________________________, authorize the charge amount of $____________ for the services described above."}</p>
            <p>{settings?.hoaPermitNote || "HOA approval and permit are the customer's responsibility when applicable."}</p>
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="border-t border-gray-900 pt-1">Customer Signature</div>
              <div className="border-t border-gray-900 pt-1">Printed Name</div>
              <div className="border-t border-gray-900 pt-1">Date</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

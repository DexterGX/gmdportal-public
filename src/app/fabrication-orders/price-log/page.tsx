import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";

const prismaAny = prisma as any;

export default async function FabricationPriceLogPage() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("fabricationOrders");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  if (appRole !== "admin") {
    redirect("/fabrication-orders");
  }

  const rows = await prismaAny.fabricationPriceChangeLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { changedByUser: { select: { name: true, email: true } } },
  });

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Price Change Log</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Every price edit made in Fabrication Order Settings, for reference.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-[10px] uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="py-1.5 pr-3">Date</th>
                <th className="py-1.5 pr-3">List</th>
                <th className="py-1.5 pr-3">Item</th>
                <th className="py-1.5 pr-3">Field</th>
                <th className="py-1.5 pr-3">Old Value</th>
                <th className="py-1.5 pr-3">New Value</th>
                <th className="py-1.5 pr-3">Changed By</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-3 text-xs text-gray-500 dark:text-gray-400">
                    No price changes logged yet.
                  </td>
                </tr>
              ) : (
                rows.map((entry: any) => (
                  <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-700/60">
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-3">{entry.entityType}</td>
                    <td className="py-1.5 pr-3">{entry.entityName}</td>
                    <td className="py-1.5 pr-3">{entry.fieldName}</td>
                    <td className="py-1.5 pr-3">{entry.oldValue ?? "-"}</td>
                    <td className="py-1.5 pr-3">{entry.newValue ?? "-"}</td>
                    <td className="py-1.5 pr-3">
                      {entry.changedByUser?.name || entry.changedByUser?.email || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

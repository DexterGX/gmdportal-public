import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import PrintButton from "./PrintButton";

const prismaAny = prisma as any;

export default async function OverdueVehiclesPrintPage() {
  const { user, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive) {
    redirect("/login");
  }

  const vehicles = await prismaAny.vehicle.findMany({
    where: { isActive: true, needsImmediateChange: true },
    orderBy: { name: "asc" },
    include: { defaultDriver: { select: { name: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4 bg-white p-2 print:p-0">
      <div className="print:hidden">
        <PrintButton />
      </div>

      <div className="border-b border-gray-300 pb-3">
        <h1 className="text-xl font-bold">Vehicles Needing Immediate Oil/Filter Change</h1>
        <p className="text-sm text-gray-600">
          Generated {new Date().toLocaleDateString()} — {vehicles.length} vehicle
          {vehicles.length === 1 ? "" : "s"}
        </p>
      </div>

      {vehicles.length === 0 ? (
        <p className="text-sm text-gray-600">No vehicles currently need an immediate change.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
              <th className="py-1 pr-2">Vehicle</th>
              <th className="py-1 pr-2">Plate</th>
              <th className="py-1 pr-2">Driver</th>
              <th className="py-1 pr-2">Current Mileage</th>
              <th className="py-1 pr-2">Miles Over</th>
              <th className="py-1 pr-2">Filter</th>
              <th className="py-1 pr-2">Oil</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v: any) => (
              <tr key={v.id} className="border-b border-gray-100">
                <td className="py-1.5 pr-2 font-medium">
                  {v.internalNumber ? `#${v.internalNumber} ` : ""}
                  {v.name}
                </td>
                <td className="py-1.5 pr-2">{v.hasPlate ? v.plate || "-" : "No Plate"}</td>
                <td className="py-1.5 pr-2">{v.defaultDriver?.name || "-"}</td>
                <td className="py-1.5 pr-2">{Number(v.currentMileage).toLocaleString()}</td>
                <td className="py-1.5 pr-2 font-semibold text-red-600">
                  {Number(v.milesExceeded).toLocaleString()}
                </td>
                <td className="py-1.5 pr-2">{v.filter || "-"}</td>
                <td className="py-1.5 pr-2">{v.oil || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

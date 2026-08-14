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

  const vehiclesRaw = await prismaAny.vehicle.findMany({
    where: { isActive: true, needsImmediateChange: true },
    include: { defaultDriver: { select: { name: true } } },
  });

  // internalNumber is stored as text, so a plain DB `orderBy` would sort
  // "10" before "2" — sort numerically here instead, with vehicles that
  // have no number pushed to the end.
  const vehicles = [...vehiclesRaw].sort((a: any, b: any) => {
    const numA = a.internalNumber != null ? Number(a.internalNumber) : NaN;
    const numB = b.internalNumber != null ? Number(b.internalNumber) : NaN;
    const aValid = Number.isFinite(numA);
    const bValid = Number.isFinite(numB);
    if (aValid && bValid && numA !== numB) return numA - numB;
    if (aValid !== bValid) return aValid ? -1 : 1;
    return String(a.name).localeCompare(String(b.name));
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4 bg-white p-2 print:p-0">
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
        <table className="w-full table-fixed border-collapse border border-gray-700 text-left text-sm print:text-xs">
          <colgroup>
            <col style={{ width: "14%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>
          <thead>
            <tr className="border border-gray-700 bg-gray-100 text-xs uppercase text-gray-700 print:bg-gray-200">
              <th className="whitespace-normal break-words border border-gray-700 py-1 pr-2 text-center [overflow-wrap:anywhere]">
                Vehicle
              </th>
              <th className="whitespace-normal break-words border border-gray-700 py-1 pr-2 text-center [overflow-wrap:anywhere]">
                Year
              </th>
              <th className="whitespace-normal break-words border border-gray-700 py-1 pr-2 text-center [overflow-wrap:anywhere]">
                Color
              </th>
              <th className="whitespace-normal break-words border border-gray-700 py-1 pr-2 text-center [overflow-wrap:anywhere]">
                Plate
              </th>
              <th className="whitespace-normal break-words border border-gray-700 py-1 pr-2 text-center [overflow-wrap:anywhere]">
                Driver
              </th>
              <th className="whitespace-normal break-words border border-gray-700 py-1 pr-2 text-center [overflow-wrap:anywhere]">
                Last Oil/Filter Change
              </th>
              <th className="whitespace-normal break-words border border-gray-700 py-1 pr-2 text-center [overflow-wrap:anywhere]">
                Next Oil/Filter Change
              </th>
              <th className="whitespace-normal break-words border border-gray-700 py-1 pr-2 text-center [overflow-wrap:anywhere]">
                Current Mileage
              </th>
              <th className="whitespace-normal break-words border border-gray-700 py-1 pr-2 text-center [overflow-wrap:anywhere]">
                Miles Over
              </th>
              <th className="whitespace-normal break-words border border-gray-700 py-1 pr-2 text-center [overflow-wrap:anywhere]">
                Filter
              </th>
              <th className="whitespace-normal break-words border border-gray-700 py-1 pr-2 text-center [overflow-wrap:anywhere]">
                Oil
              </th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v: any) => (
              <tr key={v.id} className="border border-gray-700">
                <td className="whitespace-normal break-words border border-gray-700 py-1.5 pr-2 font-medium [overflow-wrap:anywhere]">
                  {v.internalNumber ? `#${v.internalNumber} ` : ""}
                  {v.name}
                </td>
                <td className="border border-gray-700 py-1.5 pr-2">{v.year || "-"}</td>
                <td className="whitespace-normal break-words border border-gray-700 py-1.5 pr-2 [overflow-wrap:anywhere]">
                  {v.color || "-"}
                </td>
                <td className="whitespace-normal break-words border border-gray-700 py-1.5 pr-2 [overflow-wrap:anywhere]">
                  {v.hasPlate ? v.plate || "-" : "No Plate"}
                </td>
                <td className="whitespace-normal break-words border border-gray-700 py-1.5 pr-2 [overflow-wrap:anywhere]">
                  {v.defaultDriver?.name || "-"}
                </td>
                <td className="border border-gray-700 py-1.5 pr-2">{Number(v.lastOilChangeMileage).toLocaleString()}</td>
                <td className="border border-gray-700 py-1.5 pr-2">{Number(v.nextChangeMileage).toLocaleString()}</td>
                <td className="border border-gray-700 py-1.5 pr-2">{Number(v.currentMileage).toLocaleString()}</td>
                <td className="border border-gray-700 py-1.5 pr-2 font-semibold text-red-600">
                  {Number(v.milesExceeded).toLocaleString()}
                </td>
                <td className="whitespace-normal break-words border border-gray-700 py-1.5 pr-2 [overflow-wrap:anywhere]">
                  {v.filter || "-"}
                </td>
                <td className="border border-gray-700 py-1.5 pr-2">{v.oil || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

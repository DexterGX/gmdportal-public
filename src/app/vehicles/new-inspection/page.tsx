import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import NewInspectionClient from "./NewInspectionClient";

const prismaAny = prisma as any;

export default async function NewInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const { user, isActive, appRoles } = await getProgramUserContext("vehicles");
  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  const { vehicleId } = await searchParams;

  const [vehiclesRaw, drivers] = await Promise.all([
    prismaAny.vehicle.findMany({
      where: { isActive: true },
      select: {
        id: true,
        internalNumber: true,
        name: true,
        plate: true,
        filter: true,
        currentMileage: true,
        defaultDriverId: true,
      },
    }),
    prismaAny.vehicleDriver.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  // internalNumber is stored as text (it's occasionally non-numeric), so a
  // plain DB `orderBy` would sort "10" before "2" — sort numerically here
  // instead, with vehicles that have no number pushed to the end.
  const vehicles = [...vehiclesRaw].sort((a: any, b: any) => {
    const numA = a.internalNumber != null ? Number(a.internalNumber) : NaN;
    const numB = b.internalNumber != null ? Number(b.internalNumber) : NaN;
    const aValid = Number.isFinite(numA);
    const bValid = Number.isFinite(numB);
    if (aValid && bValid && numA !== numB) return numA - numB;
    if (aValid !== bValid) return aValid ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <NewInspectionClient
      vehicles={vehicles}
      drivers={drivers}
      preselectedVehicleId={vehicleId || null}
    />
  );
}

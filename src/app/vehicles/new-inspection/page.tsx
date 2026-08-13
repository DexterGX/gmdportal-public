import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import NewInspectionClient from "./NewInspectionClient";

const prismaAny = prisma as any;

export default async function NewInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  const { vehicleId } = await searchParams;

  const [vehicles, drivers] = await Promise.all([
    prismaAny.vehicle.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
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

  return (
    <NewInspectionClient
      vehicles={vehicles}
      drivers={drivers}
      preselectedVehicleId={vehicleId || null}
    />
  );
}

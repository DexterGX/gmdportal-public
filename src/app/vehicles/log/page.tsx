import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import MaintenanceLogClient from "./MaintenanceLogClient";

const prismaAny = prisma as any;

export default async function VehicleMaintenanceLogPage() {
  const { user, isActive, appRoles } = await getProgramUserContext("vehicles");
  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  const drivers = await prismaAny.vehicleDriver.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return <MaintenanceLogClient drivers={drivers} />;
}

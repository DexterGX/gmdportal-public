import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import MaintenanceLogClient from "./MaintenanceLogClient";

const prismaAny = prisma as any;

export default async function VehicleMaintenanceLogPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  const drivers = await prismaAny.vehicleDriver.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return <MaintenanceLogClient drivers={drivers} />;
}

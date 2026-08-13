import "server-only";
import { computeMaintenanceStatus } from "@/lib/vehicleMaintenanceCalc";

// Recomputes a Vehicle's cached status fields from its latest active
// inspection. Used after deleting an inspection, so the dashboard reflects
// whatever inspection is now the most recent instead of stale data.
export async function recomputeVehicleCacheFromLatestInspection(
  tx: any,
  vehicleId: string,
) {
  const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return;

  const latest = await tx.vehicleInspection.findFirst({
    where: { vehicleId, isActive: true },
    orderBy: [{ inspectedAt: "desc" }, { createdAt: "desc" }],
  });

  if (!latest) {
    const status = computeMaintenanceStatus({
      currentMileage: vehicle.lastOilChangeMileage,
      lastOilChangeMileage: vehicle.lastOilChangeMileage,
      oilChangeIntervalMiles: vehicle.oilChangeIntervalMiles,
    });
    await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        currentMileage: vehicle.lastOilChangeMileage,
        nextChangeMileage: status.nextChangeMileage,
        milesRemaining: status.milesRemaining,
        milesExceeded: status.milesExceeded,
        needsImmediateChange: status.immediateChangeRequired,
        lastInspectionAt: null,
      },
    });
    return;
  }

  const status = computeMaintenanceStatus({
    currentMileage: latest.mileage,
    lastOilChangeMileage: vehicle.lastOilChangeMileage,
    oilChangeIntervalMiles: vehicle.oilChangeIntervalMiles,
  });

  await tx.vehicle.update({
    where: { id: vehicleId },
    data: {
      currentMileage: latest.mileage,
      nextChangeMileage: status.nextChangeMileage,
      milesRemaining: status.milesRemaining,
      milesExceeded: status.milesExceeded,
      needsImmediateChange: status.immediateChangeRequired,
      lastInspectionAt: latest.inspectedAt,
    },
  });
}

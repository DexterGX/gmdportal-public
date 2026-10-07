import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import { computeMaintenanceStatus } from "@/lib/vehicleMaintenanceCalc";

const prismaAny = prisma as any;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("vehicles");
  if (!user || !isActive || appRoles.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const confirmedMileage = Number(body.confirmedMileage);
    if (!Number.isFinite(confirmedMileage) || confirmedMileage < 0) {
      return NextResponse.json(
        { error: "A valid mileage is required" },
        { status: 400 },
      );
    }

    const vehicle = await prismaAny.vehicle.findUnique({ where: { id } });
    if (!vehicle || !vehicle.isActive) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // The new baseline for "miles since last oil change" is the mileage at
    // which the change was just completed.
    const newCurrentMileage = Math.max(vehicle.currentMileage, confirmedMileage);
    const status = computeMaintenanceStatus({
      currentMileage: newCurrentMileage,
      lastOilChangeMileage: confirmedMileage,
      oilChangeIntervalMiles: vehicle.oilChangeIntervalMiles,
    });

    const result = await prisma.$transaction(async (tx: any) => {
      const inspection = await tx.vehicleInspection.create({
        data: {
          vehicleId: id,
          driverId: vehicle.defaultDriverId,
          mileage: confirmedMileage,
          oilChangeIntervalAtInspection: vehicle.oilChangeIntervalMiles,
          lastOilChangeMileageAtInspection: confirmedMileage,
          nextChangeMileage: confirmedMileage + vehicle.oilChangeIntervalMiles,
          filterAtInspection: vehicle.filter,
          milesRemaining: vehicle.oilChangeIntervalMiles,
          milesExceeded: null,
          immediateChangeRequired: false,
          isOilChangeEvent: true,
          createdById: user.id,
        },
      });

      const updated = await tx.vehicle.update({
        where: { id },
        data: {
          lastOilChangeMileage: confirmedMileage,
          currentMileage: newCurrentMileage,
          nextChangeMileage: status.nextChangeMileage,
          milesRemaining: status.milesRemaining,
          milesExceeded: status.milesExceeded,
          needsImmediateChange: status.immediateChangeRequired,
          lastInspectionAt: inspection.inspectedAt,
        },
      });

      await tx.vehicleHistory.create({
        data: {
          vehicleId: id,
          action: "OIL_CHANGE_COMPLETED",
          fieldName: "lastOilChangeMileage",
          oldValue: String(vehicle.lastOilChangeMileage),
          newValue: String(confirmedMileage),
          changedById: user.id,
        },
      });

      return { inspection, vehicle: updated };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Failed to complete oil change", error);
    return NextResponse.json(
      { error: error?.message || "Failed to complete oil change" },
      { status: 500 },
    );
  }
}

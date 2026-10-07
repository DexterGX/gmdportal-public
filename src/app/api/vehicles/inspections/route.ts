import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import { computeMaintenanceStatus } from "@/lib/vehicleMaintenanceCalc";

const prismaAny = prisma as any;

async function requireCreator() {
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("vehicles");
  if (!user || !isActive || appRoles.length === 0) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (!canAccess) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, user, appRole };
}

function parseBool(value: unknown): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

export async function GET(request: NextRequest) {
  const auth = await requireCreator();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = request.nextUrl;
  const vehicleId = searchParams.get("vehicleId")?.trim();
  const driverId = searchParams.get("driverId")?.trim();
  const dateFrom = searchParams.get("dateFrom")?.trim();
  const dateTo = searchParams.get("dateTo")?.trim();
  const immediateOnly = searchParams.get("immediateOnly") === "true";
  const q = searchParams.get("q")?.trim();

  const where: any = { isActive: true };
  if (vehicleId) where.vehicleId = vehicleId;
  if (driverId) where.driverId = driverId;
  if (immediateOnly) where.immediateChangeRequired = true;
  if (dateFrom || dateTo) {
    where.inspectedAt = {};
    if (dateFrom) where.inspectedAt.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.inspectedAt.lte = end;
    }
  }
  if (q) {
    where.vehicle = { name: { contains: q, mode: "insensitive" } };
  }

  const inspections = await prismaAny.vehicleInspection.findMany({
    where,
    orderBy: [{ inspectedAt: "desc" }, { createdAt: "desc" }],
    include: {
      vehicle: {
        select: { id: true, name: true, internalNumber: true, plate: true },
      },
      driver: { select: { id: true, name: true } },
      createdBy: { select: { name: true, email: true } },
    },
    take: 1000,
  });

  return NextResponse.json(inspections);
}

export async function POST(request: NextRequest) {
  const auth = await requireCreator();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const vehicleId = String(body.vehicleId || "").trim();
    const mileage = Number(body.mileage);

    if (!vehicleId) {
      return NextResponse.json(
        { error: "Vehicle is required" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(mileage) || mileage < 0) {
      return NextResponse.json(
        { error: "A valid mileage is required" },
        { status: 400 },
      );
    }

    const vehicle = await prismaAny.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!vehicle || !vehicle.isActive) {
      return NextResponse.json(
        { error: "Vehicle not found" },
        { status: 404 },
      );
    }

    const status = computeMaintenanceStatus({
      currentMileage: mileage,
      lastOilChangeMileage: vehicle.lastOilChangeMileage,
      oilChangeIntervalMiles: vehicle.oilChangeIntervalMiles,
    });

    const inspectedAt = body.inspectedAt ? new Date(body.inspectedAt) : new Date();

    const result = await prisma.$transaction(async (tx: any) => {
      const inspection = await tx.vehicleInspection.create({
        data: {
          vehicleId,
          inspectedAt: Number.isNaN(inspectedAt.getTime())
            ? new Date()
            : inspectedAt,
          driverId: body.driverId || null,
          mileage,
          waterLevelOk: parseBool(body.waterLevelOk),
          oilLevelOk: parseBool(body.oilLevelOk),
          tiresOk: parseBool(body.tiresOk),
          sunpassOk: parseBool(body.sunpassOk),
          conditionNote: body.conditionNote?.trim() || null,
          repairNote: body.repairNote?.trim() || null,
          oilChangeIntervalAtInspection: vehicle.oilChangeIntervalMiles,
          lastOilChangeMileageAtInspection: vehicle.lastOilChangeMileage,
          nextChangeMileage: status.nextChangeMileage,
          filterAtInspection: vehicle.filter,
          milesRemaining: status.milesRemaining,
          milesExceeded: status.milesExceeded,
          immediateChangeRequired: status.immediateChangeRequired,
          createdById: auth.user.id,
        },
      });

      // Only advance the vehicle's cached "current" status if this is the
      // newest active inspection on record — protects against a back-dated
      // entry clobbering a more recent reading.
      const newest = await tx.vehicleInspection.findFirst({
        where: { vehicleId, isActive: true },
        orderBy: [{ inspectedAt: "desc" }, { createdAt: "desc" }],
      });

      if (newest && newest.id === inspection.id) {
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: {
            currentMileage: mileage,
            nextChangeMileage: status.nextChangeMileage,
            milesRemaining: status.milesRemaining,
            milesExceeded: status.milesExceeded,
            needsImmediateChange: status.immediateChangeRequired,
            lastInspectionAt: inspection.inspectedAt,
          },
        });
      }

      return inspection;
    });

    return NextResponse.json(
      { id: result.id, status },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("Failed to save inspection", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save inspection" },
      { status: 500 },
    );
  }
}

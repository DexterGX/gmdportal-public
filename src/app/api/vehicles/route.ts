import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import { computeMaintenanceStatus } from "@/lib/vehicleMaintenanceCalc";

const prismaAny = prisma as any;

async function requireViewer() {
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("vehicles");
  if (!user || !isActive || appRoles.length === 0) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (!canAccess) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, user, appRole };
}

async function requireAdmin() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("vehicles");
  if (!user || !isActive || appRoles.length === 0) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (appRole !== "admin") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, user };
}

export async function GET(request: NextRequest) {
  const auth = await requireViewer();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();
  const driverId = searchParams.get("driverId")?.trim();
  const status = searchParams.get("status") || "active"; // active | archived | all
  const needsImmediateChange = searchParams.get("needsImmediateChange");

  const where: any = {};
  if (status === "active") where.isActive = true;
  if (status === "archived") where.isActive = false;
  if (driverId) where.defaultDriverId = driverId;
  if (needsImmediateChange === "true") where.needsImmediateChange = true;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { internalNumber: { contains: q, mode: "insensitive" } },
      { plate: { contains: q, mode: "insensitive" } },
    ];
  }

  const vehicles = await prismaAny.vehicle.findMany({
    where,
    include: {
      defaultDriver: { select: { id: true, name: true } },
      inspections: {
        where: { isActive: true },
        orderBy: [{ inspectedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        include: { driver: { select: { id: true, name: true } } },
      },
    },
    take: 500,
  });

  // internalNumber is stored as text (it's occasionally non-numeric), so a
  // plain DB `orderBy` would sort "10" before "2" — sort numerically here
  // instead, with vehicles that have no number pushed to the end.
  vehicles.sort((a: any, b: any) => {
    const numA = a.internalNumber != null ? Number(a.internalNumber) : NaN;
    const numB = b.internalNumber != null ? Number(b.internalNumber) : NaN;
    const aValid = Number.isFinite(numA);
    const bValid = Number.isFinite(numB);
    if (aValid && bValid && numA !== numB) return numA - numB;
    if (aValid !== bValid) return aValid ? -1 : 1;
    return String(a.name).localeCompare(String(b.name));
  });

  return NextResponse.json(vehicles);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "Vehicle name is required" },
        { status: 400 },
      );
    }

    const oilChangeIntervalMiles = Number.isFinite(
      Number(body.oilChangeIntervalMiles),
    )
      ? Number(body.oilChangeIntervalMiles)
      : 5000;
    const currentMileage = Number.isFinite(Number(body.startingCurrentMileage))
      ? Number(body.startingCurrentMileage)
      : 0;
    const lastOilChangeMileage = Number.isFinite(
      Number(body.startingLastOilChangeMileage),
    )
      ? Number(body.startingLastOilChangeMileage)
      : currentMileage;

    const status = computeMaintenanceStatus({
      currentMileage,
      lastOilChangeMileage,
      oilChangeIntervalMiles,
    });

    const hasPlate = body.hasPlate !== false;
    const hasSunpass = body.hasSunpass !== false;

    const year = Number.isFinite(Number(body.year)) && body.year !== "" && body.year != null
      ? Number(body.year)
      : null;

    const vehicle = await prismaAny.vehicle.create({
      data: {
        internalNumber: body.internalNumber?.trim() || null,
        name,
        year,
        color: body.color?.trim() || null,
        plate: hasPlate ? body.plate?.trim() || null : null,
        hasPlate,
        sunpass: hasSunpass ? body.sunpass?.trim() || null : null,
        hasSunpass,
        filter: body.filter?.trim() || null,
        oil: body.oil?.trim() || null,
        notes: body.notes?.trim() || null,
        defaultDriverId: body.defaultDriverId || null,
        oilChangeIntervalMiles,
        lastOilChangeMileage,
        currentMileage,
        nextChangeMileage: status.nextChangeMileage,
        milesRemaining: status.milesRemaining,
        milesExceeded: status.milesExceeded,
        needsImmediateChange: status.immediateChangeRequired,
        createdById: auth.user.id,
      },
    });

    await prismaAny.vehicleHistory.create({
      data: {
        vehicleId: vehicle.id,
        action: "CREATED",
        changedById: auth.user.id,
      },
    });

    return NextResponse.json({ id: vehicle.id }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create vehicle", error);
    const message =
      error?.code === "P2002"
        ? "That internal number is already in use."
        : error?.message || "Failed to create vehicle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

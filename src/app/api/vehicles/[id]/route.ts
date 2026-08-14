import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { computeMaintenanceStatus } from "@/lib/vehicleMaintenanceCalc";

const prismaAny = prisma as any;

const VIEW_ROLES = [
  "admin",
  "sales",
  "office",
  "finance",
  "specialist",
  "installer",
];

async function requireViewer() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (!VIEW_ROLES.includes(appRole)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, user, appRole };
}

async function requireAdmin() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (appRole !== "admin") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, user };
}

function fieldDiffEntries(
  vehicleId: string,
  changedById: string,
  fields: Array<{ name: string; oldValue: unknown; newValue: unknown }>,
) {
  return fields
    .filter((f) => String(f.oldValue ?? "") !== String(f.newValue ?? ""))
    .map((f) => ({
      vehicleId,
      action: "UPDATED",
      fieldName: f.name,
      oldValue: f.oldValue == null ? null : String(f.oldValue),
      newValue: f.newValue == null ? null : String(f.newValue),
      changedById,
    }));
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireViewer();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const vehicle = await prismaAny.vehicle.findUnique({
    where: { id },
    include: {
      defaultDriver: { select: { id: true, name: true } },
      inspections: {
        where: { isActive: true },
        orderBy: [{ inspectedAt: "desc" }, { createdAt: "desc" }],
        take: 25,
        include: { driver: { select: { id: true, name: true } } },
      },
    },
  });

  if (!vehicle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(vehicle);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "Vehicle name is required" },
        { status: 400 },
      );
    }

    const existing = await prismaAny.vehicle.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const oilChangeIntervalMiles = Number.isFinite(
      Number(body.oilChangeIntervalMiles),
    )
      ? Number(body.oilChangeIntervalMiles)
      : existing.oilChangeIntervalMiles;
    const lastOilChangeMileage = Number.isFinite(
      Number(body.lastOilChangeMileage),
    )
      ? Number(body.lastOilChangeMileage)
      : existing.lastOilChangeMileage;

    const status = computeMaintenanceStatus({
      currentMileage: existing.currentMileage,
      lastOilChangeMileage,
      oilChangeIntervalMiles,
    });

    const hasPlate = body.hasPlate !== false;
    const hasSunpass = body.hasSunpass !== false;
    const year = Number.isFinite(Number(body.year)) && body.year !== "" && body.year != null
      ? Number(body.year)
      : null;

    const data = {
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
      nextChangeMileage: status.nextChangeMileage,
      milesRemaining: status.milesRemaining,
      milesExceeded: status.milesExceeded,
      needsImmediateChange: status.immediateChangeRequired,
    };

    const historyEntries = fieldDiffEntries(id, auth.user.id, [
      { name: "name", oldValue: existing.name, newValue: name },
      { name: "year", oldValue: existing.year, newValue: year },
      { name: "color", oldValue: existing.color, newValue: data.color },
      { name: "plate", oldValue: existing.plate, newValue: data.plate },
      { name: "sunpass", oldValue: existing.sunpass, newValue: data.sunpass },
      { name: "filter", oldValue: existing.filter, newValue: data.filter },
      { name: "oil", oldValue: existing.oil, newValue: data.oil },
      {
        name: "oilChangeIntervalMiles",
        oldValue: existing.oilChangeIntervalMiles,
        newValue: oilChangeIntervalMiles,
      },
      {
        name: "lastOilChangeMileage",
        oldValue: existing.lastOilChangeMileage,
        newValue: lastOilChangeMileage,
      },
    ]);

    await prisma.$transaction(async (tx: any) => {
      await tx.vehicle.update({ where: { id }, data });
      if (historyEntries.length) {
        await tx.vehicleHistory.createMany({ data: historyEntries });
      }
    });

    return NextResponse.json({ id });
  } catch (error: any) {
    console.error("Failed to update vehicle", error);
    const message =
      error?.code === "P2002"
        ? "That internal number is already in use."
        : error?.message || "Failed to update vehicle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const existing = await prismaAny.vehicle.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prismaAny.vehicle.delete({ where: { id } });
  } catch (error: any) {
    if (error?.code === "P2003" || error?.code === "P2014") {
      return NextResponse.json(
        {
          error:
            "This vehicle has recorded inspections and can't be permanently deleted. Archive it instead.",
        },
        { status: 409 },
      );
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}

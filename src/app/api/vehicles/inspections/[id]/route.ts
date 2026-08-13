import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { recomputeVehicleCacheFromLatestInspection } from "@/lib/vehicleCache";

const prismaAny = prisma as any;

const VIEW_ROLES = [
  "admin",
  "sales",
  "office",
  "finance",
  "specialist",
  "installer",
];

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!VIEW_ROLES.includes(appRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const inspection = await prismaAny.vehicleInspection.findUnique({
    where: { id },
    include: {
      vehicle: {
        select: { id: true, name: true, internalNumber: true, plate: true },
      },
      driver: { select: { id: true, name: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(inspection);
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (appRole !== "admin") {
    return NextResponse.json(
      { error: "Only admins can permanently delete an inspection." },
      { status: 403 },
    );
  }

  const { id } = await context.params;

  const existing = await prismaAny.vehicleInspection.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.vehicleInspection.delete({ where: { id } });
    await recomputeVehicleCacheFromLatestInspection(tx, existing.vehicleId);
  });

  return NextResponse.json({ success: true });
}

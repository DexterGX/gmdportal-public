import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("vehicles");
  if (!user || !isActive || appRoles.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (appRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const nextActive = body.active === true;

  const vehicle = await prismaAny.vehicle.findUnique({ where: { id } });
  if (!vehicle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prismaAny.vehicle.update({
    where: { id },
    data: { isActive: nextActive },
  });

  await prismaAny.vehicleHistory.create({
    data: {
      vehicleId: id,
      action: nextActive ? "RESTORED" : "ARCHIVED",
      changedById: user.id,
    },
  });

  return NextResponse.json(updated);
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("cabinetEstimates");
  if (!user || !isActive || appRoles.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const nextActive = body.active === true;

  const estimate = await prismaAny.cabinetEstimate.findUnique({ where: { id } });
  if (!estimate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prismaAny.cabinetEstimate.update({
    where: { id },
    data: { isActive: nextActive },
  });

  await prismaAny.cabinetEstimateHistory.create({
    data: {
      estimateId: id,
      action: nextActive ? "RESTORED" : "ARCHIVED",
      changedById: user.id,
    },
  });

  return NextResponse.json(updated);
}

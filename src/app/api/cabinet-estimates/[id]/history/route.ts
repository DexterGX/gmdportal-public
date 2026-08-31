import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const prismaAny = prisma as any;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const entries = await prismaAny.cabinetEstimateHistory.findMany({
    where: { estimateId: id },
    orderBy: { createdAt: "desc" },
    include: { changedByUser: { select: { name: true, email: true } } },
  });

  return NextResponse.json(entries);
}

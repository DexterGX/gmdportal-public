import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("fabricationOrders");
  if (!user || !isActive || appRoles.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const history = await prismaAny.fabricationOrderHistory.findMany({
    where: { orderId: id },
    orderBy: { createdAt: "desc" },
    include: { changedByUser: { select: { name: true, email: true } } },
  });

  return NextResponse.json(history);
}

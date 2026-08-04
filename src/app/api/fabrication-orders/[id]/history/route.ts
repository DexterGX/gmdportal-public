import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const prismaAny = prisma as any;
const CREATE_ROLES = ["admin", "sales", "office"];

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!CREATE_ROLES.includes(appRole)) {
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

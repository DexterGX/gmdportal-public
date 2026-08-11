import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const prismaAny = prisma as any;
const CREATE_ROLES = ["admin", "sales", "office"];

export async function POST(
  request: NextRequest,
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
  const body = await request.json().catch(() => ({}));
  const nextActive = body.active === true;

  const order = await prismaAny.fabricationOrder.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prismaAny.fabricationOrder.update({
    where: { id },
    data: { isActive: nextActive },
  });

  await prismaAny.fabricationOrderHistory.create({
    data: {
      orderId: id,
      action: nextActive ? "RESTORED" : "ARCHIVED",
      changedById: user.id,
    },
  });

  return NextResponse.json(updated);
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { user, appRole } = await getCurrentUserWithRole();
  if (!user || appRole === "unassigned") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId") || undefined;
  const type = searchParams.get("type") || undefined;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  const where: Record<string, unknown> = {};
  if (itemId) where.itemId = itemId;
  if (type) where.type = type;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const transactions = await prisma.storeInventoryTransaction.findMany({
    where,
    include: {
      item: {
        select: {
          id: true,
          name: true,
          unit: true,
          department: { select: { id: true, label: true } },
          group: { select: { id: true, label: true } },
        },
      },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return NextResponse.json(transactions);
}

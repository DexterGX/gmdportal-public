import { NextRequest, NextResponse } from "next/server";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { user, appRoles } = await getProgramUserContext("storeInventory");
  if (!user || appRoles.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;

  const requests = await prisma.storeRestockRequest.findMany({
    where: status ? { status: status as any } : undefined,
    include: {
      item: {
        include: {
          department: true,
          group: true,
          providers: { include: { provider: true }, orderBy: { isPreferred: "desc" } },
        },
      },
      requestedByUser: { select: { id: true, name: true, email: true } },
      actionedByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = requests.map((r) => ({
    ...r,
    item: r.item
      ? {
          ...r.item,
          providers: r.item.providers.map((p) => ({ ...p, cost: p.cost ? Number(p.cost) : null })),
        }
      : r.item,
  }));

  return NextResponse.json(serialized);
}

export async function POST(request: NextRequest) {
  const { user, appRoles } = await getProgramUserContext("storeInventory");
  if (!user || appRoles.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const itemId = typeof body?.itemId === "string" ? body.itemId : "";
  const requestedQty = Number(body?.requestedQty);

  if (!itemId || !Number.isFinite(requestedQty) || requestedQty <= 0) {
    return NextResponse.json({ error: "A valid item and quantity are required" }, { status: 400 });
  }

  const created = await prisma.storeRestockRequest.create({
    data: {
      itemId,
      requestedQty,
      notes: body.notes || null,
      requestedByUserId: user.id,
    },
    include: {
      item: { include: { department: true, group: true } },
      requestedByUser: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(created, { status: 201 });
}

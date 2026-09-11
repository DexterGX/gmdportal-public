import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { canManageStoreInventory, getStockStatus } from "@/lib/storeInventory";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { user, appRole } = await getCurrentUserWithRole();
  if (!user || appRole === "unassigned") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const item = await prisma.storeItem.findUnique({
    where: { id },
    include: {
      department: true,
      group: true,
      providers: { include: { provider: true }, orderBy: { isPreferred: "desc" } },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      restockRequests: {
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          requestedByUser: { select: { id: true, name: true, email: true } },
          actionedByUser: { select: { id: true, name: true, email: true } },
        },
      },
      _count: { select: { restockRequests: { where: { status: "REQUESTED" } } } },
    },
  });

  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  return NextResponse.json({
    ...item,
    providers: item.providers.map((p) => ({ ...p, cost: p.cost ? Number(p.cost) : null })),
    stockStatus: getStockStatus(item.quantity, item.minQuantity),
    pendingRequestCount: item._count.restockRequests,
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { user, appRole } = await getCurrentUserWithRole();
  if (!user || !canManageStoreInventory(appRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("departmentId" in body) data.departmentId = body.departmentId || null;
  if ("groupId" in body) data.groupId = body.groupId || null;
  if (typeof body.unit === "string" && body.unit.trim()) data.unit = body.unit.trim();
  if (Number.isFinite(body.minQuantity)) data.minQuantity = Number(body.minQuantity);
  if (Number.isFinite(body.recommendedQuantity)) data.recommendedQuantity = Number(body.recommendedQuantity);
  if ("location" in body) {
    data.location = typeof body.location === "string" && body.location.trim() ? body.location.trim() : null;
  }
  if ("purchaseLink" in body) data.purchaseLink = body.purchaseLink || null;
  if ("notes" in body) data.notes = body.notes || null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  const updated = await prisma.storeItem.update({
    where: { id },
    data,
    include: { department: true, group: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { user, appRole } = await getCurrentUserWithRole();
  if (!user || !canManageStoreInventory(appRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const hard = searchParams.get("hard") === "true";

  if (hard) {
    // Permanent delete: cascades to remove transactions, restock requests, and provider links.
    await prisma.storeItem.delete({ where: { id } }).catch((error: { code?: string }) => {
      if (error?.code === "P2025") return null;
      throw error;
    });
    return NextResponse.json({ ok: true });
  }

  // Soft-delete: keep transaction/request history intact.
  const updated = await prisma.storeItem.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json(updated);
}

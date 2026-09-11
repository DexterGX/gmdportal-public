import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { canManageStoreInventory, ensureStoreTaxonomySeeded, getStockStatus } from "@/lib/storeInventory";

export async function GET(request: NextRequest) {
  const { user, appRole } = await getCurrentUserWithRole();
  if (!user || appRole === "unassigned") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureStoreTaxonomySeeded();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const departmentId = searchParams.get("departmentId") || undefined;
  const groupId = searchParams.get("groupId") || undefined;
  const stockStatus = searchParams.get("stockStatus") || undefined; // low | critical
  const includeInactive = searchParams.get("includeInactive") === "true";

  const where: Record<string, unknown> = {};
  if (!includeInactive) where.isActive = true;
  if (departmentId) where.departmentId = departmentId;
  if (groupId) where.groupId = groupId;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }

  const items = await prisma.storeItem.findMany({
    where,
    include: {
      department: true,
      group: true,
      providers: {
        include: { provider: true },
        orderBy: { isPreferred: "desc" },
      },
      _count: { select: { restockRequests: { where: { status: "REQUESTED" } } } },
    },
    orderBy: { name: "asc" },
  });

  const withStatus = items.map((item) => ({
    ...item,
    providers: item.providers.map((p) => ({
      ...p,
      cost: p.cost ? Number(p.cost) : null,
    })),
    stockStatus: getStockStatus(item.quantity, item.minQuantity),
    pendingRequestCount: item._count.restockRequests,
  }));

  const filtered = stockStatus
    ? withStatus.filter((item) => item.stockStatus === stockStatus)
    : withStatus;

  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const { user, appRole } = await getCurrentUserWithRole();
  if (!user || !canManageStoreInventory(appRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Item name is required" }, { status: 400 });
  }

  const quantity = Number.isFinite(body.quantity) ? Number(body.quantity) : 0;

  const created = await prisma.storeItem.create({
    data: {
      name,
      departmentId: body.departmentId || null,
      groupId: body.groupId || null,
      unit: typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : "each",
      quantity,
      minQuantity: Number.isFinite(body.minQuantity) ? Number(body.minQuantity) : 0,
      recommendedQuantity: Number.isFinite(body.recommendedQuantity)
        ? Number(body.recommendedQuantity)
        : 0,
      location: typeof body.location === "string" && body.location.trim() ? body.location.trim() : null,
      purchaseLink: body.purchaseLink || null,
      notes: body.notes || null,
    },
    include: { department: true, group: true },
  });

  if (quantity > 0) {
    await prisma.storeInventoryTransaction.create({
      data: {
        itemId: created.id,
        itemName: created.name,
        itemUnit: created.unit,
        type: "INITIAL",
        change: quantity,
        oldQuantity: 0,
        newQuantity: quantity,
        reason: "Initial stock on item creation",
        userId: user.id,
      },
    });
  }

  return NextResponse.json(created, { status: 201 });
}

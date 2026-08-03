import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { canManageStoreInventory } from "@/lib/storeInventory";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { user, appRole } = await getCurrentUserWithRole();
  if (!user || !canManageStoreInventory(appRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const providerId = typeof body?.providerId === "string" ? body.providerId : "";
  if (!providerId) {
    return NextResponse.json({ error: "providerId is required" }, { status: 400 });
  }

  if (body.isPreferred) {
    await prisma.storeItemProvider.updateMany({
      where: { itemId: id },
      data: { isPreferred: false },
    });
  }

  const link = await prisma.storeItemProvider.upsert({
    where: { itemId_providerId: { itemId: id, providerId } },
    update: {
      purchaseLink: body.purchaseLink || null,
      providerSku: body.providerSku || null,
      cost: body.cost ?? null,
      isPreferred: Boolean(body.isPreferred),
    },
    create: {
      itemId: id,
      providerId,
      purchaseLink: body.purchaseLink || null,
      providerSku: body.providerSku || null,
      cost: body.cost ?? null,
      isPreferred: Boolean(body.isPreferred),
    },
    include: { provider: true },
  });

  return NextResponse.json({ ...link, cost: link.cost ? Number(link.cost) : null }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await context.params;
  const { user, appRole } = await getCurrentUserWithRole();
  if (!user || !canManageStoreInventory(appRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const linkId = searchParams.get("linkId");
  if (!linkId) return NextResponse.json({ error: "linkId is required" }, { status: 400 });

  await prisma.storeItemProvider.delete({ where: { id: linkId } }).catch(() => null);

  return NextResponse.json({ ok: true });
}

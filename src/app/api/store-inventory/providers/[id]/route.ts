import { NextRequest, NextResponse } from "next/server";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { canManageStoreInventory } from "@/lib/storeInventory";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { user, appRole, appRoles } = await getProgramUserContext("storeInventory");
  if (!user || appRoles.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = await prisma.storeProvider.findUnique({
    where: { id },
    include: {
      items: { include: { item: true }, orderBy: { isPreferred: "desc" } },
    },
  });

  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  return NextResponse.json({
    ...provider,
    items: provider.items.map((i) => ({ ...i, cost: i.cost ? Number(i.cost) : null })),
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { user, appRole, appRoles } = await getProgramUserContext("storeInventory");
  if (!user || !canManageStoreInventory(appRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("contactName" in body) data.contactName = body.contactName || null;
  if ("contactPhone" in body) data.contactPhone = body.contactPhone || null;
  if ("contactEmail" in body) data.contactEmail = body.contactEmail || null;
  if ("website" in body) data.website = body.website || null;
  if ("address" in body) data.address = body.address || null;
  if ("notes" in body) data.notes = body.notes || null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  const updated = await prisma.storeProvider.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { user, appRole, appRoles } = await getProgramUserContext("storeInventory");
  if (!user || !canManageStoreInventory(appRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const hard = searchParams.get("hard") === "true";

  if (hard) {
    // Permanent delete: cascades to remove provider-item links, but leaves the items themselves.
    await prisma.storeProvider.delete({ where: { id } }).catch((error: { code?: string }) => {
      if (error?.code === "P2025") return null;
      throw error;
    });
    return NextResponse.json({ ok: true });
  }

  const updated = await prisma.storeProvider.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json(updated);
}

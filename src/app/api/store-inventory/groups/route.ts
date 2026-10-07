import { NextRequest, NextResponse } from "next/server";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { ensureStoreTaxonomySeeded, normalizeKey, canManageStoreInventory } from "@/lib/storeInventory";

export async function GET() {
  const { user, appRole, appRoles } = await getProgramUserContext("storeInventory");
  if (!user || appRoles.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureStoreTaxonomySeeded();

  const groups = await prisma.storeGroup.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  return NextResponse.json(groups);
}

export async function POST(request: NextRequest) {
  const { user, appRole, appRoles } = await getProgramUserContext("storeInventory");
  if (!user || !canManageStoreInventory(appRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!label) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const key = normalizeKey(label);
  const maxSortOrder = await prisma.storeGroup.aggregate({ _max: { sortOrder: true } });

  const created = await prisma.storeGroup
    .create({
      data: { key, label, sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1 },
    })
    .catch((error: { code?: string }) => {
      if (error?.code === "P2002") return null;
      throw error;
    });

  if (!created) {
    return NextResponse.json({ error: "A group with that name already exists" }, { status: 409 });
  }

  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { user, appRole, appRoles } = await getProgramUserContext("storeInventory");
  if (!user || !canManageStoreInventory(appRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.label === "string" && body.label.trim()) data.label = body.label.trim();
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;

  const updated = await prisma.storeGroup.update({ where: { id }, data });
  return NextResponse.json(updated);
}

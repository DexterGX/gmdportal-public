import { NextRequest, NextResponse } from "next/server";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { canManageStoreInventory } from "@/lib/storeInventory";

export async function GET(request: NextRequest) {
  const { user, appRole, appRoles } = await getProgramUserContext("storeInventory");
  if (!user || appRoles.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  const providers = await prisma.storeProvider.findMany({
    where: includeInactive ? undefined : { isActive: true },
    include: {
      _count: { select: { items: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(providers);
}

export async function POST(request: NextRequest) {
  const { user, appRole, appRoles } = await getProgramUserContext("storeInventory");
  if (!user || !canManageStoreInventory(appRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Provider name is required" }, { status: 400 });
  }

  const created = await prisma.storeProvider
    .create({
      data: {
        name,
        contactName: body.contactName || null,
        contactPhone: body.contactPhone || null,
        contactEmail: body.contactEmail || null,
        website: body.website || null,
        address: body.address || null,
        notes: body.notes || null,
      },
    })
    .catch((error: { code?: string }) => {
      if (error?.code === "P2002") return null;
      throw error;
    });

  if (!created) {
    return NextResponse.json({ error: "A provider with that name already exists" }, { status: 409 });
  }

  return NextResponse.json(created, { status: 201 });
}

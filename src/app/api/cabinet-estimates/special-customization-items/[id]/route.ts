import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireAdmin() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("cabinetEstimates");
  if (!user || !isActive || appRoles.length === 0) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (appRole !== "admin") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, user };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const existing = await prismaAny.cabinetSpecialCustomizationItem.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data: any = {};
    if (body.name !== undefined) {
      const name = String(body.name || "").trim();
      if (!name) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      data.name = name;
    }
    if (body.price !== undefined) {
      data.price = Math.max(0, toNumber(body.price));
    }
    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }
    if (body.sortOrder !== undefined) {
      data.sortOrder = Math.trunc(toNumber(body.sortOrder));
    }

    const item = await prismaAny.cabinetSpecialCustomizationItem.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ...item, price: toNumber(item.price) });
  } catch (error: any) {
    console.error("Failed to update special customization item", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update item" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const existing = await prismaAny.cabinetSpecialCustomizationItem.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Never hard-delete a catalog item that's already used on a saved estimate
  // - that would silently corrupt that estimate's history. Deactivate
  // (Archive) it instead, same soft-delete-by-default convention as
  // everything else with history in this app.
  const usageCount = await prismaAny.cabinetEstimateSpecialCustomizationLine.count({
    where: { itemId: id },
  });
  if (usageCount > 0) {
    return NextResponse.json(
      {
        error:
          "This item is used on one or more saved estimates and can't be deleted. Deactivate it instead.",
      },
      { status: 409 },
    );
  }

  await prismaAny.cabinetSpecialCustomizationItem.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

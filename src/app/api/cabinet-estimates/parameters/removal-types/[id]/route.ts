import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const prismaAny = prisma as any;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireAdmin() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
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

  const existing = await prismaAny.cabinetRemovalType.findUnique({ where: { id } });
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
    if (body.percent !== undefined) {
      data.percent = toNumber(body.percent);
    }
    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }
    if (body.sortOrder !== undefined) {
      data.sortOrder = Math.trunc(toNumber(body.sortOrder));
    }

    const type = await prismaAny.cabinetRemovalType.update({ where: { id }, data });
    return NextResponse.json({ ...type, percent: toNumber(type.percent) });
  } catch (error: any) {
    console.error("Failed to update removal type", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update removal type" },
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

  const existing = await prismaAny.cabinetRemovalType.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Never hard-delete a type already billed on a saved estimate - that
  // would corrupt that estimate's snapshot/history. Deactivate instead,
  // same soft-delete convention as CabinetInstallationType.
  const usageCount = await prismaAny.cabinetEstimate.count({
    where: { removalTypeId: id },
  });
  if (usageCount > 0) {
    return NextResponse.json(
      {
        error:
          "This removal type is used on one or more saved estimates and can't be deleted. Deactivate it instead.",
      },
      { status: 409 },
    );
  }

  await prismaAny.cabinetRemovalType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

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

  const existing = await prismaAny.cabinetDiscountOption.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data: any = {};
    if (body.percent !== undefined) {
      const parsed = Number(body.percent);
      const percent = Number.isFinite(parsed) ? Math.trunc(parsed) : NaN;
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        return NextResponse.json(
          { error: "Percent must be a whole number from 0 to 100" },
          { status: 400 },
        );
      }
      if (percent !== existing.percent) {
        const duplicate = await prismaAny.cabinetDiscountOption.findUnique({
          where: { percent },
        });
        if (duplicate) {
          return NextResponse.json(
            { error: `A ${percent}% discount option already exists` },
            { status: 409 },
          );
        }
      }
      data.percent = percent;
    }
    if (body.label !== undefined) {
      data.label = String(body.label || "").trim();
    }
    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }
    if (body.sortOrder !== undefined) {
      data.sortOrder = Math.trunc(Number(body.sortOrder) || 0);
    }

    const option = await prismaAny.cabinetDiscountOption.update({ where: { id }, data });
    return NextResponse.json(option);
  } catch (error: any) {
    console.error("Failed to update discount option", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update discount option" },
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

  const existing = await prismaAny.cabinetDiscountOption.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Saved estimates keep the percent they were billed at, so removing the
  // option would not change them - but keep the same "deactivate, don't
  // delete" safety as other parameter lists when it has history.
  const usageCount = await prismaAny.cabinetEstimate.count({
    where: { discountPercent: existing.percent },
  });
  if (usageCount > 0) {
    return NextResponse.json(
      {
        error:
          "This discount is used on one or more saved estimates and can't be deleted. Deactivate it instead.",
      },
      { status: 409 },
    );
  }

  await prismaAny.cabinetDiscountOption.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

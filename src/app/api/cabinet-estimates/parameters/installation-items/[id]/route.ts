import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const prismaAny = prisma as any;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const CABINET_SUMMARY_BUCKETS = ["STANDARD", "DOUBLE", "CUSTOM", "MISC"];

// Round 12 follow-up - see the matching helper in the parent route.ts for
// the full explanation of what bucketDefault does.
function normalizeBucketDefault(value: unknown): string | null {
  return typeof value === "string" && CABINET_SUMMARY_BUCKETS.includes(value) ? value : null;
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

  const existing = await prismaAny.cabinetInstallationServiceItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data: any = {};
    if (body.description !== undefined) {
      const description = String(body.description || "").trim();
      if (!description) {
        return NextResponse.json({ error: "Description is required" }, { status: 400 });
      }
      data.description = description;
    }
    if (body.code !== undefined) {
      data.code = body.code ? String(body.code).trim() : null;
    }
    if (body.salePrice !== undefined) {
      data.salePrice = toNumber(body.salePrice);
    }
    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }
    if (body.sortOrder !== undefined) {
      data.sortOrder = Math.trunc(toNumber(body.sortOrder));
    }
    if (body.bucketDefault !== undefined) {
      data.bucketDefault = normalizeBucketDefault(body.bucketDefault);
    }

    const item = await prismaAny.$transaction(async (tx: any) => {
      // Claiming a bucket default silently takes it from whichever other
      // item held it before, rather than erroring on the unique
      // constraint - same convention as the create route.
      if (data.bucketDefault) {
        await tx.cabinetInstallationServiceItem.updateMany({
          where: { bucketDefault: data.bucketDefault, NOT: { id } },
          data: { bucketDefault: null },
        });
      }
      return tx.cabinetInstallationServiceItem.update({ where: { id }, data });
    });
    return NextResponse.json({ ...item, salePrice: toNumber(item.salePrice) });
  } catch (error: any) {
    console.error("Failed to update installation item", error);
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "An installation item with that code already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error?.message || "Failed to update installation item" },
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

  const existing = await prismaAny.cabinetInstallationServiceItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Never hard-delete an installation item already billed on a saved
  // estimate line, or still assigned to catalog items - that would either
  // corrupt a snapshot or silently orphan future imports. Deactivate
  // instead, same soft-delete convention as CabinetSpecialCustomizationItem
  // and CabinetInstallationType.
  const [lineItemUsage, catalogUsage] = await Promise.all([
    prismaAny.cabinetEstimateLineItem.count({ where: { installationItemId: id } }),
    prismaAny.cabinetCatalogItem.count({ where: { installationItemId: id } }),
  ]);
  if (lineItemUsage > 0 || catalogUsage > 0) {
    return NextResponse.json(
      {
        error:
          "This installation item is used on one or more saved estimates or catalog items and can't be deleted. Deactivate it instead.",
      },
      { status: 409 },
    );
  }

  await prismaAny.cabinetInstallationServiceItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const prismaAny = prisma as any;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const CABINET_SUMMARY_BUCKETS = ["STANDARD", "DOUBLE", "CUSTOM", "MISC"];

// Round 12 follow-up: bucketDefault marks this item as the deterministic
// installation-item assignment for every catalog item resolving to that
// bucket (see the schema comment on
// CabinetInstallationServiceItem.bucketDefault). Only one active item may
// hold a given bucket at a time (DB-enforced via @@unique) - normalize an
// invalid/blank value down to null rather than erroring.
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

// Round 11 - the real GMD Installers Price Table (replaces the old 4-bucket
// labor rates). GET is admin-only here (unlike the parent /parameters
// route) since it's only used by the GMD Parameters management UI itself -
// the estimate form reads the active list (id/code/description/salePrice)
// from GET /api/cabinet-estimates/parameters instead.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const items = await prismaAny.cabinetInstallationServiceItem.findMany({
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { description: "asc" }],
  });
  return NextResponse.json({
    installationItems: items.map((item: any) => ({
      id: item.id,
      code: item.code,
      description: item.description,
      salePrice: toNumber(item.salePrice),
      isActive: item.isActive,
      sortOrder: item.sortOrder,
      bucketDefault: item.bucketDefault || null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const description = String(body.description || "").trim();
    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    const maxSortOrder = await prismaAny.cabinetInstallationServiceItem.aggregate({
      _max: { sortOrder: true },
    });
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;
    const bucketDefault = normalizeBucketDefault(body.bucketDefault);

    const item = await prismaAny.$transaction(async (tx: any) => {
      // At most one active item can hold a given bucket default - claiming
      // it here silently takes it from whichever item held it before,
      // rather than erroring on the unique constraint.
      if (bucketDefault) {
        await tx.cabinetInstallationServiceItem.updateMany({
          where: { bucketDefault },
          data: { bucketDefault: null },
        });
      }
      return tx.cabinetInstallationServiceItem.create({
        data: {
          code: body.code ? String(body.code).trim() : null,
          description,
          salePrice: toNumber(body.salePrice),
          isActive: body.isActive === undefined ? true : Boolean(body.isActive),
          sortOrder: Number.isFinite(toNumber(body.sortOrder))
            ? Math.trunc(toNumber(body.sortOrder))
            : nextSortOrder,
          bucketDefault,
        },
      });
    });

    return NextResponse.json(
      { ...item, salePrice: toNumber(item.salePrice) },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("Failed to create installation item", error);
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "An installation item with that code already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error?.message || "Failed to create installation item" },
      { status: 500 },
    );
  }
}

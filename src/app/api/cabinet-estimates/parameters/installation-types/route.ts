import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import { getCabinetEstimateParameters } from "@/lib/cabinetEstimateParameters";

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

// GET is admin-only here (unlike the parent /parameters route) since it's
// only used by the GMD Parameters management UI itself - the estimate form
// reads the full bundle (including active installation types) from
// GET /api/cabinet-estimates/parameters instead.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { installationTypes } = await getCabinetEstimateParameters(prismaAny);
  return NextResponse.json({ installationTypes });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const maxSortOrder = await prismaAny.cabinetInstallationType.aggregate({
      _max: { sortOrder: true },
    });
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

    const type = await prismaAny.cabinetInstallationType.create({
      data: {
        name,
        multiplier: toNumber(body.multiplier) || 1,
        isActive: body.isActive === undefined ? true : Boolean(body.isActive),
        sortOrder: Number.isFinite(toNumber(body.sortOrder))
          ? Math.trunc(toNumber(body.sortOrder))
          : nextSortOrder,
      },
    });

    return NextResponse.json(
      { ...type, multiplier: toNumber(type.multiplier) },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("Failed to create installation type", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create installation type" },
      { status: 500 },
    );
  }
}

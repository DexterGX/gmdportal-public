import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import { getCabinetEstimateParameters } from "@/lib/cabinetEstimateParameters";

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

function toPercent(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const whole = Math.trunc(parsed);
  return whole >= 0 && whole <= 100 ? whole : null;
}

// Admin-only list used by the GMD Parameters screen. The estimate form reads
// the same rows from the shared GET /api/cabinet-estimates/parameters bundle.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { discountOptions } = await getCabinetEstimateParameters(prismaAny);
  return NextResponse.json({ discountOptions });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const percent = toPercent(body.percent);
    if (percent === null) {
      return NextResponse.json(
        { error: "Percent must be a whole number from 0 to 100" },
        { status: 400 },
      );
    }
    const duplicate = await prismaAny.cabinetDiscountOption.findUnique({
      where: { percent },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: `A ${percent}% discount option already exists` },
        { status: 409 },
      );
    }

    const maxSortOrder = await prismaAny.cabinetDiscountOption.aggregate({
      _max: { sortOrder: true },
    });
    const option = await prismaAny.cabinetDiscountOption.create({
      data: {
        percent,
        label: String(body.label || "").trim(),
        isActive: body.isActive === undefined ? true : Boolean(body.isActive),
        sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json(option, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create discount option", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create discount option" },
      { status: 500 },
    );
  }
}

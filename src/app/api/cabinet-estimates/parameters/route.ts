import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { getCabinetEstimateParameters } from "@/lib/cabinetEstimateParameters";

const prismaAny = prisma as any;

// GET is open to any active user - the estimate form needs to read these
// values to show a live Installation preview while someone fills out an
// estimate, not just admins. Editing (PATCH below) stays admin-only.
export async function GET() {
  try {
    const { user, isActive } = await getCurrentUserWithRole();
    if (!user || !isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const bundle = await getCabinetEstimateParameters(prismaAny);
    return NextResponse.json(bundle);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load GMD Parameters" },
      { status: 500 },
    );
  }
}

type PatchBody = {
  installationBasePercent?: number | string;
  installationCalcMode?: string;
  customSurchargePercent?: number | string;
};

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toCalcMode(value: unknown): "flat" | "perItem" | "higher" {
  return value === "flat" || value === "perItem" ? value : "higher";
}

export async function PATCH(request: Request) {
  try {
    const { user, appRole, isActive } = await getCurrentUserWithRole();
    if (!user || !isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as PatchBody;
    const existing = await prismaAny.cabinetEstimateParameters.findFirst();
    const data = {
      installationBasePercent: toNumber(body.installationBasePercent),
      installationCalcMode: toCalcMode(body.installationCalcMode),
      customSurchargePercent: toNumber(body.customSurchargePercent),
    };
    const saved = existing
      ? await prismaAny.cabinetEstimateParameters.update({
          where: { id: existing.id },
          data,
        })
      : await prismaAny.cabinetEstimateParameters.create({ data });

    return NextResponse.json(saved);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save GMD Parameters" },
      { status: 500 },
    );
  }
}

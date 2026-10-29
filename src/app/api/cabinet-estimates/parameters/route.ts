import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import { getCabinetEstimateParameters } from "@/lib/cabinetEstimateParameters";
import { getProgramVersion } from "@/lib/cabinetProgramVersion";

const prismaAny = prisma as any;

// GET is open to any active user - the estimate form needs to read these
// values to show a live Installation preview while someone fills out an
// estimate, not just admins. Editing (PATCH below) stays admin-only.
export async function GET() {
  try {
    const { user, isActive, appRole } = await getProgramUserContext("cabinetEstimates");
    if (!user || !isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const bundle = await getCabinetEstimateParameters(prismaAny);
    // Program version: everyone gets the public one; only admins also get
    // the true one (they differ after a "don't show publicly" table update).
    const version = await getProgramVersion(prismaAny);
    return NextResponse.json({
      ...bundle,
      programVersion: {
        public: version.public,
        actual: appRole === "admin" ? version.actual : null,
      },
    });
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
  costTaxPercent?: number | string;
  catalogLinkUrl?: string | null;
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
    const { user, appRole, isActive } = await getProgramUserContext("cabinetEstimates");
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
      // Only touched when sent, so older callers can't reset it to 0.
      ...(body.costTaxPercent !== undefined
        ? { costTaxPercent: toNumber(body.costTaxPercent) }
        : {}),
      ...(body.catalogLinkUrl !== undefined
        ? { catalogLinkUrl: String(body.catalogLinkUrl || "").trim() || null }
        : {}),
    };
    if (data.catalogLinkUrl && !/^https?:\/\/\S+$/i.test(data.catalogLinkUrl)) {
      return NextResponse.json(
        { error: "The catalog link must start with http:// or https://" },
        { status: 400 },
      );
    }
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

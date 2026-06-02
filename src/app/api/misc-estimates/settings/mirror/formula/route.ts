import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const prismaAny = prisma as any;

type MirrorFormulaBody = {
  cuttingFee?: number;
  outletCost?: number;
  outletSale?: number;
  lightCutoutCost?: number;
  lightCutoutSale?: number;
  outOfSquareBeveledCost?: number;
  outOfSquareBeveledSale?: number;
  removalPricePerSqFt?: number;
  repairWallMultiplier?: number;
};

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(request: Request) {
  try {
    const { user, appRole, isActive } = await getCurrentUserWithRole();

    if (!user || !isActive || appRole === "unassigned") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as MirrorFormulaBody;
    const existing = await prismaAny.miscMirrorSetting.findFirst();

    const data = {
      cuttingFee: asNumber(body.cuttingFee),
      outletCost: asNumber(body.outletCost),
      outletSale: asNumber(body.outletSale),
      lightCutoutCost: asNumber(body.lightCutoutCost),
      lightCutoutSale: asNumber(body.lightCutoutSale),
      outOfSquareBeveledCost: asNumber(body.outOfSquareBeveledCost),
      outOfSquareBeveledSale: asNumber(body.outOfSquareBeveledSale),
      removalPricePerSqFt: asNumber(body.removalPricePerSqFt),
      repairWallMultiplier: asNumber(body.repairWallMultiplier, 0.7),
    };

    const saved = existing
      ? await prismaAny.miscMirrorSetting.update({
          where: { id: existing.id },
          data,
        })
      : await prismaAny.miscMirrorSetting.create({ data });

    return NextResponse.json(saved);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save mirror formula settings" },
      { status: 500 },
    );
  }
}

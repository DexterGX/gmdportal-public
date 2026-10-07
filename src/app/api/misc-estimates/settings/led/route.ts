import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  try {
    const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("miscEstimates");

    if (!user || !isActive || appRoles.length === 0) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const includeInactive =
      request.nextUrl.searchParams.get("includeInactive") === "1" &&
      appRole === "admin";

    const [
      rooms,
      ledTypes,
      controlTypes,
      profiles,
      sheetTypes,
      mirrorColors,
      glassDoorShelfTypes,
      islandPanelModels,
      mirrorFrameFinishes,
      mirrorBevelOptions,
      mirrorSetting,
      wallUnitSetting,
      mirrorFrameSetting,
    ] = await Promise.all([
      prismaAny.miscLedRoom.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prismaAny.miscLedType.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prismaAny.miscLedControlType.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prismaAny.miscLedProfile.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prismaAny.miscLedSheetType.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prismaAny.miscMirrorColor.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prismaAny.miscGlassDoorShelfType.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prismaAny.miscIslandPanelModel.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prismaAny.miscMirrorFrameFinish.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prismaAny.miscMirrorBevelOption.findMany({
        where: includeInactive ? {} : { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prismaAny.miscMirrorSetting.findFirst(),
      prismaAny.miscWallUnitSetting.findFirst(),
      prismaAny.miscMirrorFrameSetting.findFirst(),
    ]);

    return NextResponse.json({
      rooms,
      ledTypes: ledTypes.map((item: any) => ({
        ...item,
        minimumPriceUnder25Ft: toNumber(item.minimumPriceUnder25Ft),
        pricePerFt: toNumber(item.pricePerFt),
      })),
      controlTypes: controlTypes.map((item: any) => ({
        ...item,
        unitPrice: toNumber(item.unitPrice),
      })),
      profiles: profiles.map((item: any) => ({
        ...item,
        unitPrice: toNumber(item.unitPrice),
        groovePricePerFt: toNumber(item.groovePricePerFt),
      })),
      sheetTypes: sheetTypes.map((item: any) => ({
        ...item,
        minimumPrice: toNumber(item.minimumPrice),
        unitPrice: toNumber(item.unitPrice),
      })),
      mirrorColors: mirrorColors.map((item: any) => ({
        ...item,
        venda: toNumber(item.venda),
        custo: toNumber(item.custo),
      })),
      glassDoorShelfTypes: glassDoorShelfTypes.map((item: any) => ({
        ...item,
        venda: toNumber(item.venda),
        custo: toNumber(item.custo),
      })),
      islandPanelModels: islandPanelModels.map((item: any) => ({
        ...item,
        sfPerBox: toNumber(item.sfPerBox),
        cost: toNumber(item.cost),
        salesPrice: toNumber(item.salesPrice),
      })),
      mirrorFrameFinishes: mirrorFrameFinishes.map((item: any) => ({
        ...item,
        pricePerLinearFt: toNumber(item.pricePerLinearFt),
      })),
      mirrorBevelOptions: mirrorBevelOptions.map((item: any) => ({
        ...item,
        venda: toNumber(item.venda),
        custo: toNumber(item.custo),
      })),
      mirrorSetting: {
        cuttingFee: toNumber(mirrorSetting?.cuttingFee),
        outletCost: toNumber(mirrorSetting?.outletCost),
        outletSale: toNumber(mirrorSetting?.outletSale),
        lightCutoutCost: toNumber(mirrorSetting?.lightCutoutCost),
        lightCutoutSale: toNumber(mirrorSetting?.lightCutoutSale),
        outOfSquareBeveledCost: toNumber(mirrorSetting?.outOfSquareBeveledCost),
        outOfSquareBeveledSale: toNumber(mirrorSetting?.outOfSquareBeveledSale),
        removalPricePerSqFt: toNumber(mirrorSetting?.removalPricePerSqFt),
        repairWallMultiplier: toNumber(mirrorSetting?.repairWallMultiplier),
      },
      wallUnitSetting: {
        constructionPricePerSqFt: toNumber(
          wallUnitSetting?.constructionPricePerSqFt,
        ),
      },
      mirrorFrameSetting: {
        minimumCharge: toNumber(mirrorFrameSetting?.minimumCharge),
        paintingFactor: toNumber(mirrorFrameSetting?.paintingFactor) || 1,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load LED settings" },
      { status: 500 },
    );
  }
}

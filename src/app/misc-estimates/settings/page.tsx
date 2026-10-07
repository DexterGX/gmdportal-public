import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import MiscLedSettingsClient from "./MiscLedSettingsClient";

const prismaAny = prisma as any;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function MiscLedSettingsPage() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("miscEstimates");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  if (appRole !== "admin") {
    redirect("/misc-estimates");
  }

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
    programNotes,
  ] = await Promise.all([
    prismaAny.miscLedRoom.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.miscLedType.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.miscLedControlType.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.miscLedProfile.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.miscLedSheetType.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.miscMirrorColor.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.miscGlassDoorShelfType.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.miscIslandPanelModel.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.miscMirrorFrameFinish.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.miscMirrorBevelOption.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.miscMirrorSetting.findFirst(),
    prismaAny.miscWallUnitSetting.findFirst(),
    prismaAny.miscMirrorFrameSetting.findFirst(),
    prismaAny.miscProgramNote.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        content: true,
        catalogUrl: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <MiscLedSettingsClient
      initialRooms={rooms}
      initialLedTypes={ledTypes.map((item: any) => ({
        ...item,
        minimumPriceUnder25Ft: toNumber(item.minimumPriceUnder25Ft),
        pricePerFt: toNumber(item.pricePerFt),
      }))}
      initialControlTypes={controlTypes.map((item: any) => ({
        ...item,
        unitPrice: toNumber(item.unitPrice),
      }))}
      initialProfiles={profiles.map((item: any) => ({
        ...item,
        unitPrice: toNumber(item.unitPrice),
        groovePricePerFt: toNumber(item.groovePricePerFt),
      }))}
      initialSheetTypes={sheetTypes.map((item: any) => ({
        ...item,
        minimumPrice: toNumber(item.minimumPrice),
        unitPrice: toNumber(item.unitPrice),
      }))}
      initialMirrorColors={mirrorColors.map((item: any) => ({
        ...item,
        venda: toNumber(item.venda),
        custo: toNumber(item.custo),
      }))}
      initialGlassDoorShelfTypes={glassDoorShelfTypes.map((item: any) => ({
        ...item,
        venda: toNumber(item.venda),
        custo: toNumber(item.custo),
      }))}
      initialIslandPanelModels={islandPanelModels.map((item: any) => ({
        ...item,
        sfPerBox: toNumber(item.sfPerBox),
        cost: toNumber(item.cost),
        salesPrice: toNumber(item.salesPrice),
      }))}
      initialMirrorFrameFinishes={mirrorFrameFinishes.map((item: any) => ({
        ...item,
        pricePerLinearFt: toNumber(item.pricePerLinearFt),
      }))}
      initialMirrorBevelOptions={mirrorBevelOptions.map((item: any) => ({
        ...item,
        venda: toNumber(item.venda),
        custo: toNumber(item.custo),
      }))}
      initialMirrorSetting={{
        cuttingFee: toNumber(mirrorSetting?.cuttingFee),
        outletCost: toNumber(mirrorSetting?.outletCost),
        outletSale: toNumber(mirrorSetting?.outletSale),
        lightCutoutCost: toNumber(mirrorSetting?.lightCutoutCost),
        lightCutoutSale: toNumber(mirrorSetting?.lightCutoutSale),
        outOfSquareBeveledCost: toNumber(mirrorSetting?.outOfSquareBeveledCost),
        outOfSquareBeveledSale: toNumber(mirrorSetting?.outOfSquareBeveledSale),
        removalPricePerSqFt: toNumber(mirrorSetting?.removalPricePerSqFt),
        repairWallMultiplier: toNumber(mirrorSetting?.repairWallMultiplier),
      }}
      initialWallUnitSetting={{
        constructionPricePerSqFt: toNumber(
          wallUnitSetting?.constructionPricePerSqFt,
        ),
      }}
      initialMirrorFrameSetting={{
        minimumCharge: toNumber(mirrorFrameSetting?.minimumCharge),
        paintingFactor: toNumber(mirrorFrameSetting?.paintingFactor) || 1,
      }}
      initialProgramNotes={programNotes.map((item: any) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      }))}
      initialSheetMinPrice={0}
    />
  );
}

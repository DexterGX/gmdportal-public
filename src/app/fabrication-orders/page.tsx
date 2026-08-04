import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import FabricationOrderForm from "./FabricationOrderForm";

const prismaAny = prisma as any;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function NewFabricationOrderPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  const [
    edgeTypes,
    slabTypes,
    sinkCutouts,
    cooktops,
    bumpOuts,
    cuttingBoards,
    windowsills,
    powerStations,
    otherCharges,
    removals,
    slabSuppliers,
    stoneRows,
  ] = await Promise.all([
    prismaAny.fabricationEdgeType.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.fabricationSlabTypeOption.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.fabricationSinkCutoutOption.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.fabricationCooktopCutoutOption.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.fabricationBumpOutOption.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.fabricationCuttingBoardOption.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.fabricationWindowsillOption.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.fabricationPowerStationOption.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.fabricationOtherChargeOption.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.fabricationRemovalOption.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prismaAny.slabBrandConfig.findMany({ orderBy: { name: "asc" } }),
    prismaAny.slab.findMany({
      distinct: ["color"],
      select: { color: true },
      take: 500,
      orderBy: { color: "asc" },
    }),
  ]);

  const numify = (list: any[], fields: string[]) =>
    list.map((item) => {
      const copy: any = { ...item };
      fields.forEach((f) => (copy[f] = toNumber(item[f])));
      return copy;
    });

  return (
    <FabricationOrderForm
      currentUserName={user.name || user.email || ""}
      edgeTypes={numify(edgeTypes, ["pricePerSqft"])}
      slabTypes={numify(slabTypes, ["multiplier"])}
      sinkCutouts={numify(sinkCutouts, ["price"])}
      cooktops={numify(cooktops, ["price"])}
      bumpOuts={numify(bumpOuts, ["price"])}
      cuttingBoards={numify(cuttingBoards, ["price"])}
      windowsills={numify(windowsills, ["price"])}
      powerStations={numify(powerStations, ["price"])}
      otherCharges={numify(otherCharges, ["price"])}
      removals={numify(removals, ["price"])}
      slabSuppliers={slabSuppliers}
      stoneSuggestions={stoneRows.map((r: any) => r.color).filter(Boolean)}
    />
  );
}

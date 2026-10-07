import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { FABRICATION_SETTINGS_CATEGORIES } from "@/lib/fabricationSettings";
import { getHiddenPriceListCategories } from "@/lib/fabricationPriceListVisibility";
import FabricationSettingsClient from "./FabricationSettingsClient";

const prismaAny = prisma as any;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function FabricationSettingsPage() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("fabricationOrders");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  if (appRole !== "admin") {
    redirect("/fabrication-orders");
  }

  const [lists, hiddenCategories] = await Promise.all([
    Promise.all(
      FABRICATION_SETTINGS_CATEGORIES.map((config) =>
        prismaAny[config.modelKey].findMany({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
      ),
    ),
    getHiddenPriceListCategories(),
  ]);

  const initialItems: Record<string, any[]> = {};
  FABRICATION_SETTINGS_CATEGORIES.forEach((config, index) => {
    initialItems[config.category] = lists[index].map((item: any) =>
      config.dbField
        ? { ...item, [config.dbField]: toNumber(item[config.dbField]) }
        : item,
    );
  });

  return (
    <FabricationSettingsClient
      initialItems={initialItems as any}
      initialHiddenCategories={hiddenCategories as any}
    />
  );
}

import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { FABRICATION_SETTINGS_CATEGORIES } from "@/lib/fabricationSettings";
import { getHiddenPriceListCategories } from "@/lib/fabricationPriceListVisibility";
import PriceListClient from "./PriceListClient";

const prismaAny = prisma as any;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Read-only, printable view of every active Fabrication Order price list —
// available to anyone who can access the module (not just admins, unlike
// the editable Settings page), so sales/office can look prices up without
// needing admin access.
export default async function FabricationPriceListPage() {
  const { user, isActive, appRoles } = await getProgramUserContext("fabricationOrders");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  const [lists, hiddenCategories] = await Promise.all([
    Promise.all(
      FABRICATION_SETTINGS_CATEGORIES.map((config) =>
        prismaAny[config.modelKey].findMany({
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
      ),
    ),
    getHiddenPriceListCategories(),
  ]);
  const hiddenSet = new Set(hiddenCategories);

  const items: Record<string, any[]> = {};
  const visibleCategories = FABRICATION_SETTINGS_CATEGORIES.filter(
    (config) => !hiddenSet.has(config.category),
  );
  visibleCategories.forEach((config) => {
    const index = FABRICATION_SETTINGS_CATEGORIES.indexOf(config);
    items[config.category] = lists[index].map((item: any) =>
      config.dbField
        ? { ...item, [config.dbField]: toNumber(item[config.dbField]) }
        : item,
    );
  });

  return (
    <PriceListClient
      items={items as any}
      visibleCategories={visibleCategories.map((c) => c.category)}
    />
  );
}

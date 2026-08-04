import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { FABRICATION_SETTINGS_CATEGORIES } from "@/lib/fabricationSettings";
import FabricationSettingsClient from "./FabricationSettingsClient";

const prismaAny = prisma as any;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function FabricationSettingsPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (appRole !== "admin") {
    redirect("/fabrication-orders");
  }

  const lists = await Promise.all(
    FABRICATION_SETTINGS_CATEGORIES.map((config) =>
      prismaAny[config.modelKey].findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ),
  );

  const initialItems: Record<string, any[]> = {};
  FABRICATION_SETTINGS_CATEGORIES.forEach((config, index) => {
    initialItems[config.category] = lists[index].map((item: any) => ({
      ...item,
      [config.dbField]: toNumber(item[config.dbField]),
    }));
  });

  return <FabricationSettingsClient initialItems={initialItems as any} />;
}

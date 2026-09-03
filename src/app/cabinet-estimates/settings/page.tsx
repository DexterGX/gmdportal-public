import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import SpecialCustomizationSettingsClient from "./SpecialCustomizationSettingsClient";

const prismaAny = prisma as any;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function CabinetSpecialCustomizationSettingsPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole !== "admin") {
    redirect("/cabinet-estimates");
  }

  const items = await prismaAny.cabinetSpecialCustomizationItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <SpecialCustomizationSettingsClient
      initialItems={items.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: toNumber(item.price),
        isActive: item.isActive,
        sortOrder: item.sortOrder,
      }))}
    />
  );
}

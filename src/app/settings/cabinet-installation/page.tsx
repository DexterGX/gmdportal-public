import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import CabinetInstallationClient from "./CabinetInstallationClient";

const prismaAny = prisma as any;

function serializeProfiles(profiles: any[]) {
  return profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    code: profile.code,
    notes: profile.notes,
    costTierId: profile.costTierId,
    costTier: profile.costTier
      ? {
          id: profile.costTier.id,
          key: profile.costTier.key,
          name: profile.costTier.name,
        }
      : null,
    isActive: profile.isActive,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  }));
}

function serializeCostTiers(costTiers: any[]) {
  return costTiers.map((tier) => ({
    id: tier.id,
    key: tier.key,
    name: tier.name,
    isActive: tier.isActive,
    sortOrder: tier.sortOrder,
  }));
}

function serializeItems(items: any[]) {
  return items.map((item) => ({
    id: item.id,
    code: item.code,
    description: item.description,
    category: item.category,
    defaultWillingToPay: item.defaultWillingToPay.toString(),
    salePrice: item.salePrice.toString(),
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    costs: item.costs.map((cost: any) => ({
      id: cost.id,
      itemId: cost.itemId,
      costTierId: cost.costTierId,
      cost: cost.cost.toString(),
      costTier: {
        id: cost.costTier.id,
        key: cost.costTier.key,
        name: cost.costTier.name,
      },
    })),
  }));
}

export default async function CabinetInstallationPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/settings/cabinet-installation");
  }

  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole !== "admin") {
    redirect("/settings");
  }

  const [profiles, costTiers, items] = await Promise.all([
    prismaAny.cabinetInstallerProfile.findMany({
      include: {
        costTier: {
          select: { id: true, key: true, name: true },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prismaAny.cabinetInstallationCostTier.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    }),
    prismaAny.cabinetInstallationItem.findMany({
      include: {
        costs: {
          include: {
            costTier: {
              select: { id: true, key: true, name: true },
            },
          },
          orderBy: {
            costTier: { sortOrder: "asc" },
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { description: "asc" }],
    }),
  ]);

  return (
    <CabinetInstallationClient
      initialProfiles={serializeProfiles(profiles)}
      initialCostTiers={serializeCostTiers(costTiers)}
      initialItems={serializeItems(items)}
    />
  );
}

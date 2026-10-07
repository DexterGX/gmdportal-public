import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { canManageStoreInventory } from "@/lib/storeInventory";
import ProviderDetailClient from "./ProviderDetailClient";

interface Props {
  params: Promise<{ providerId: string }>;
}

export default async function StoreInventoryProviderDetailPage({ params }: Props) {
  const { providerId } = await params;
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("storeInventory");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  if (!canManageStoreInventory(appRole)) {
    redirect("/store-inventory");
  }

  return <ProviderDetailClient providerId={providerId} />;
}

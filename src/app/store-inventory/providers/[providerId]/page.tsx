import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { canManageStoreInventory } from "@/lib/storeInventory";
import ProviderDetailClient from "./ProviderDetailClient";

interface Props {
  params: Promise<{ providerId: string }>;
}

export default async function StoreInventoryProviderDetailPage({ params }: Props) {
  const { providerId } = await params;
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (!canManageStoreInventory(appRole)) {
    redirect("/store-inventory");
  }

  return <ProviderDetailClient providerId={providerId} />;
}

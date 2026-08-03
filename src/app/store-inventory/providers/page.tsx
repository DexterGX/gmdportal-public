import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { canManageStoreInventory } from "@/lib/storeInventory";
import ProvidersClient from "./ProvidersClient";

export default async function StoreInventoryProvidersPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (!canManageStoreInventory(appRole)) {
    redirect("/store-inventory");
  }

  return <ProvidersClient canManage />;
}

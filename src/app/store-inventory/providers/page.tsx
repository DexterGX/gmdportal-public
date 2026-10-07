import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { canManageStoreInventory } from "@/lib/storeInventory";
import ProvidersClient from "./ProvidersClient";

export default async function StoreInventoryProvidersPage() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("storeInventory");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  if (!canManageStoreInventory(appRole)) {
    redirect("/store-inventory");
  }

  return <ProvidersClient canManage />;
}

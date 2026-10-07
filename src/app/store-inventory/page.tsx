import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import StoreInventoryClient from "./StoreInventoryClient";
import { canManageStoreInventory } from "@/lib/storeInventory";

export default async function StoreInventoryPage() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("storeInventory");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  return (
    <StoreInventoryClient
      userRole={appRole}
      userId={user.id}
      canManage={canManageStoreInventory(appRole)}
    />
  );
}

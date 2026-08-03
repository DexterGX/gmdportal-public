import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import StoreInventoryClient from "./StoreInventoryClient";
import { canManageStoreInventory } from "@/lib/storeInventory";

export default async function StoreInventoryPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
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

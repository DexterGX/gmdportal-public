import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { canManageStoreInventory } from "@/lib/storeInventory";
import ItemDetailClient from "./ItemDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StoreInventoryItemPage({ params }: Props) {
  const { id } = await params;
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  return (
    <ItemDetailClient
      itemId={id}
      userRole={appRole}
      canManage={canManageStoreInventory(appRole)}
    />
  );
}

import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { canManageStoreInventory } from "@/lib/storeInventory";
import ItemDetailClient from "./ItemDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StoreInventoryItemPage({ params }: Props) {
  const { id } = await params;
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("storeInventory");

  if (!user || !isActive || appRoles.length === 0) {
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

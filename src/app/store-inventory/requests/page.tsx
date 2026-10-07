import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { canActionRestockRequests } from "@/lib/storeInventory";
import RestockRequestsClient from "./RestockRequestsClient";

export default async function StoreInventoryRequestsPage() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("storeInventory");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  return <RestockRequestsClient canAction={canActionRestockRequests(appRole)} />;
}

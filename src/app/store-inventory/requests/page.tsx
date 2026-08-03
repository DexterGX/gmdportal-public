import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { canActionRestockRequests } from "@/lib/storeInventory";
import RestockRequestsClient from "./RestockRequestsClient";

export default async function StoreInventoryRequestsPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  return <RestockRequestsClient canAction={canActionRestockRequests(appRole)} />;
}

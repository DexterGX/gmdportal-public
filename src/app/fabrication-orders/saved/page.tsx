import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import SavedFabricationOrdersClient from "./SavedFabricationOrdersClient";

export default async function SavedFabricationOrdersPage() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("fabricationOrders");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  return <SavedFabricationOrdersClient isAdmin={appRole === "admin"} />;
}

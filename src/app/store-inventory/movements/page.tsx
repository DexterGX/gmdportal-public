import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import MovementsClient from "./MovementsClient";

export default async function StoreInventoryMovementsPage() {
  const { user, isActive, appRoles } = await getProgramUserContext("storeInventory");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  return <MovementsClient />;
}

import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import SettingsClient from "./SettingsClient";

export default async function StoreInventorySettingsPage() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("storeInventory");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  if (appRole !== "admin") {
    redirect("/store-inventory");
  }

  return <SettingsClient />;
}

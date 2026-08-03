import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import SettingsClient from "./SettingsClient";

export default async function StoreInventorySettingsPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (appRole !== "admin") {
    redirect("/store-inventory");
  }

  return <SettingsClient />;
}

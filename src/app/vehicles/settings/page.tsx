import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import VehicleSettingsClient from "./VehicleSettingsClient";

export default async function VehicleSettingsPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (appRole !== "admin") {
    redirect("/vehicles");
  }

  return <VehicleSettingsClient />;
}

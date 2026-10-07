import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import VehicleSettingsClient from "./VehicleSettingsClient";

export default async function VehicleSettingsPage() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("vehicles");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  if (appRole !== "admin") {
    redirect("/vehicles");
  }

  return <VehicleSettingsClient />;
}

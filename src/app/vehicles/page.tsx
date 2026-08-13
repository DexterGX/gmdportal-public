import { getCurrentUserWithRole } from "@/lib/authHelpers";
import VehiclesDashboardClient from "./VehiclesDashboardClient";

export default async function VehiclesPage() {
  const { appRole } = await getCurrentUserWithRole();

  return <VehiclesDashboardClient isAdmin={appRole === "admin"} />;
}

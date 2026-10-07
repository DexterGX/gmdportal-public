import { getProgramUserContext } from "@/lib/programPermissions";
import VehiclesDashboardClient from "./VehiclesDashboardClient";

export default async function VehiclesPage() {
  const { appRole } = await getProgramUserContext("vehicles");

  return <VehiclesDashboardClient isAdmin={appRole === "admin"} />;
}

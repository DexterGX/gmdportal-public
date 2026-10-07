import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import SavedEstimatesClient from "./SavedEstimatesClient";

export default async function SavedCabinetEstimatesPage() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("cabinetEstimates");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  return <SavedEstimatesClient isAdmin={appRole === "admin"} />;
}

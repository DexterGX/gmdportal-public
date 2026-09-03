import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import SavedEstimatesClient from "./SavedEstimatesClient";

export default async function SavedCabinetEstimatesPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  return <SavedEstimatesClient isAdmin={appRole === "admin"} />;
}

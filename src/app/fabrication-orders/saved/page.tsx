import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import SavedFabricationOrdersClient from "./SavedFabricationOrdersClient";

export default async function SavedFabricationOrdersPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  return <SavedFabricationOrdersClient isAdmin={appRole === "admin"} />;
}

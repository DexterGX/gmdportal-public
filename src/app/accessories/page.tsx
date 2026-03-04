import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import AccessoriesClient from "./AccessoriesClient";

export default async function AccessoriesPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  // Only authorized roles can access
  if (!["admin", "office", "finance", "sales"].includes(appRole)) {
    redirect("/dashboard");
  }

  return <AccessoriesClient userRole={appRole} userId={user.id} />;
}

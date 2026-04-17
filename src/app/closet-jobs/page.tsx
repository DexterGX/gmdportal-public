import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { getInstallers, getSalesAssignableUsers } from "@/lib/users";
import ClosetJobsClient from "./ClosetJobsClient";

export default async function ClosetJobsPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  // Only ADMIN, SALES, and INSTALLER can access
  if (!["admin", "sales", "installer"].includes(appRole)) {
    redirect("/dashboard");
  }

  // Fetch users for assignment selectors
  const [installers, salesUsers] = await Promise.all([
    getInstallers(),
    getSalesAssignableUsers(),
  ]);

  return (
    <ClosetJobsClient
      userRole={appRole}
      userId={user.id}
      installers={installers}
      salesUsers={salesUsers}
    />
  );
}

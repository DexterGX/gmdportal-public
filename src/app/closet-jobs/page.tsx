import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { getInstallers, getSalesAssignableUsers } from "@/lib/users";
import ClosetJobsClient from "./ClosetJobsClient";

export default async function ClosetJobsPage() {
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("closetJobs");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  // Access is managed in Settings → Program Access
  if (!canAccess) {
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

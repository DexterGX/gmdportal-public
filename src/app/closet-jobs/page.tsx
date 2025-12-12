import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { getInstallers } from "@/lib/users";
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

  // Fetch installers using shared helper
  const installers = await getInstallers();

  return (
    <ClosetJobsClient
      userRole={appRole}
      userId={user.id}
      installers={installers}
    />
  );
}

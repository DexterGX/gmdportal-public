import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import NewAccessoryTrackerClient from "./NewAccessoryTrackerClient";

export default async function NewAccessoryTrackerPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  // Only authorized roles can create trackers
  if (!["admin", "office", "finance"].includes(appRole)) {
    redirect("/accessories");
  }

  return <NewAccessoryTrackerClient userId={user.id} userRole={appRole} />;
}

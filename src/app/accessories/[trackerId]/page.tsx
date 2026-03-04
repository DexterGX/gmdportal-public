import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { getAccessoryTracker } from "@/lib/accessories";
import AccessoryTrackerDetailClient from "./AccessoryTrackerDetailClient";

interface Props {
  params: Promise<{
    trackerId: string;
  }>;
}

export default async function AccessoryTrackerDetailPage({ params }: Props) {
  const { trackerId } = await params;
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  // Only authorized roles can access
  if (!["admin", "office", "finance", "sales"].includes(appRole)) {
    redirect("/dashboard");
  }

  const tracker = await getAccessoryTracker(trackerId);

  if (!tracker) {
    redirect("/accessories");
  }

  return (
    <AccessoryTrackerDetailClient
      tracker={tracker}
      userId={user.id}
      userRole={appRole}
    />
  );
}

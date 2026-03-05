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

  const safeTracker = tracker
    ? JSON.parse(
        JSON.stringify(tracker, (_key, value) => {
          if (
            value &&
            typeof value === "object" &&
            value.constructor &&
            value.constructor.name === "Decimal" &&
            typeof value.toString === "function"
          ) {
            return value.toString();
          }
          return value;
        }),
      )
    : tracker;

  return (
    <AccessoryTrackerDetailClient
      tracker={safeTracker}
      userId={user.id}
      userRole={appRole}
    />
  );
}

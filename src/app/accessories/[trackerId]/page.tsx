import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { getAccessoryTracker } from "@/lib/accessories";
import AccessoryTrackerDetailClient from "./AccessoryTrackerDetailClient";

interface Props {
  params: Promise<{
    trackerId: string;
  }>;
}

export default async function AccessoryTrackerDetailPage({ params }: Props) {
  const { trackerId } = await params;
  const { user, isActive, canAccess } =
    await getProgramUserContext("accessories");

  if (!user || !isActive) {
    redirect("/login");
  }

  // Access is managed in Settings → Program Access
  if (!canAccess) {
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
      canEdit={canAccess}
    />
  );
}

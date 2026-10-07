import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import NewAccessoryTrackerClient from "./NewAccessoryTrackerClient";

export default async function NewAccessoryTrackerPage() {
  const { user, appRole, isActive, canAccess } =
    await getProgramUserContext("accessories");

  if (!user || !isActive) {
    redirect("/login");
  }

  // Access is managed in Settings → Program Access
  if (!canAccess) {
    redirect("/dashboard");
  }

  return <NewAccessoryTrackerClient userId={user.id} userRole={appRole} />;
}

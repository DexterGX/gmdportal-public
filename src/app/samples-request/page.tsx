import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import SamplesRequestClient from "./SamplesRequestClient";
import { getSampleRequestProviders } from "@/lib/samplesRequests";

export default async function SamplesRequestPage() {
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("samplesRequest");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  if (!canAccess) {
    redirect("/dashboard");
  }

  const providers = await getSampleRequestProviders({
    includeInactive: false,
  });

  return (
    <SamplesRequestClient
      userId={user.id}
      userName={user.name || user.email || "User"}
      userRole={appRole}
      providers={providers}
    />
  );
}

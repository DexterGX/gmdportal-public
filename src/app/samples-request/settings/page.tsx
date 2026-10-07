import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { getSampleRequestProviders } from "@/lib/samplesRequests";
import SamplesRequestSettingsClient from "./SamplesRequestSettingsClient";

export default async function SamplesRequestSettingsPage() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("samplesRequest");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  if (appRole !== "admin") {
    redirect("/samples-request");
  }

  const providers = await getSampleRequestProviders({
    includeInactive: true,
  });

  return <SamplesRequestSettingsClient initialProviders={providers} />;
}

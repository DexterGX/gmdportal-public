import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { getSampleRequestProviders } from "@/lib/samplesRequests";
import SamplesRequestSettingsClient from "./SamplesRequestSettingsClient";

export default async function SamplesRequestSettingsPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
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

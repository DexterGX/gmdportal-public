import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import SamplesRequestClient from "./SamplesRequestClient";
import { getSampleRequestProviders } from "@/lib/samplesRequests";

export default async function SamplesRequestPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (!(["admin", "sales", "office"] as string[]).includes(appRole)) {
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

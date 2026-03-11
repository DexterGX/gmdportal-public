import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { getSampleRequestById, getSampleRequestProviders } from "@/lib/samplesRequests";
import SamplesRequestDetailClient from "./SamplesRequestDetailClient";

export default async function SampleRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (!(["admin", "sales", "office"] as string[]).includes(appRole)) {
    redirect("/dashboard");
  }

  const request = await getSampleRequestById(requestId);

  if (!request) {
    redirect("/samples-request");
  }

  const providers = await getSampleRequestProviders({
    sampleType: request.sampleType,
    includeInactive: true,
  });
  const provider =
    providers.find((item) => item.name === request.brand) ?? null;

  return (
    <SamplesRequestDetailClient
      initialRequest={request}
      userId={user.id}
      userRole={appRole}
      provider={provider}
    />
  );
}

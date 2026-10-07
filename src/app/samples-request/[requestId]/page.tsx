import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import {
  getSampleRequestById,
  getSampleRequestProviders,
} from "@/lib/samplesRequests";
import SamplesRequestDetailClient from "./SamplesRequestDetailClient";

export default async function SampleRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("samplesRequest");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  if (!canAccess) {
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

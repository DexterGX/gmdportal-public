import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import SamplesRequestHistoryClient from "./SamplesRequestHistoryClient";

export default async function SamplesRequestHistoryPage() {
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("samplesRequest");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  if (!canAccess) {
    redirect("/dashboard");
  }

  return <SamplesRequestHistoryClient />;
}

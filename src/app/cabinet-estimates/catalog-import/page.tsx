import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import ImportClient from "./ImportClient";

export default async function CabinetEstimatesCatalogImportPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/cabinet-estimates/catalog-import");
  }

  const { appRole } = await getProgramUserContext("cabinetEstimates");
  if (appRole !== "admin") {
    redirect("/cabinet-estimates");
  }

  return <ImportClient />;
}

import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import ImportClient from "./ImportClient";

export default async function CabinetEstimatesCatalogImportPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/cabinet-estimates/catalog-import");
  }

  const { appRole } = await getCurrentUserWithRole();
  if (appRole !== "admin") {
    redirect("/cabinet-estimates");
  }

  return <ImportClient />;
}

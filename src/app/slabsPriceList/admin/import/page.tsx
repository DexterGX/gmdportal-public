import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import ImportClient from "./ImportClient";

export default async function ImportPriceListPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/slabsPriceList/admin/import");
  }

  // Check if user is ADMIN
  const { appRole } = await getCurrentUserWithRole();
  if (appRole !== "admin") {
    redirect("/slabsPriceList");
  }

  return <ImportClient />;
}

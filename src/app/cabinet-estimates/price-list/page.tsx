import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import PriceListClient from "./PriceListClient";

export default async function PriceListPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/cabinet-estimates/price-list");
  }

  const { appRole } = await getCurrentUserWithRole();
  if (appRole !== "admin") {
    redirect("/cabinet-estimates");
  }

  return <PriceListClient />;
}

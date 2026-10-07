import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import AdminPromotionalClient from "./AdminPromotionalClient";

export default async function AdminPromotionalPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/slabsPriceList/admin/promotional");
  }

  const { appRole } = await getProgramUserContext("slabs");
  if (appRole !== "admin") {
    redirect("/slabsPriceList/promotional");
  }

  return <AdminPromotionalClient />;
}

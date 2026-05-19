import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import SinkImportForm from "../../components/SinkImportForm";

export default async function SinkImportPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/sinksPriceList/admin/import");
  }

  const { appRole } = await getCurrentUserWithRole();
  if (appRole !== "admin") {
    redirect("/sinksPriceList");
  }

  return <SinkImportForm />;
}

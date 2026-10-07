import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import authOptions from "@/lib/auth";
import { getProgramUserContext } from "@/lib/programPermissions";
import CustomersSyncClient from "./CustomersSyncClient";

export const metadata = {
  title: "Pipedrive Sync | GM Design Portal",
  description: "Sync deals from Pipedrive to create customer records",
};

export default async function CustomersSyncPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { appRole } = await getProgramUserContext("customersV2");

  if (appRole !== "admin") {
    redirect("/customers-v2");
  }

  return <CustomersSyncClient />;
}

import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import QuickBooksSyncClient from "./QuickBooksSyncClient";

export default async function QuickBooksSyncPage() {
  const { appRole } = await getProgramUserContext("customersV2");

  if (appRole !== "admin") {
    redirect("/customers-v2");
  }

  return <QuickBooksSyncClient />;
}

import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import QuickBooksSyncClient from "./QuickBooksSyncClient";

export default async function QuickBooksSyncPage() {
  const { appRole } = await getCurrentUserWithRole();

  if (appRole !== "admin") {
    redirect("/customers");
  }

  return <QuickBooksSyncClient />;
}

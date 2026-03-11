import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import SamplesRequestHistoryClient from "./SamplesRequestHistoryClient";

export default async function SamplesRequestHistoryPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (!(["admin", "sales", "office"] as string[]).includes(appRole)) {
    redirect("/dashboard");
  }

  return <SamplesRequestHistoryClient />;
}

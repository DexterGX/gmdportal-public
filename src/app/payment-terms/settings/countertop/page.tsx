import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import CountertopSettingsClient from "./CountertopSettingsClient";

export default async function CountertopSettingsPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (appRole !== "admin") {
    return (
      <div className="max-w-3xl mx-auto rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
        Access denied.
      </div>
    );
  }

  return <CountertopSettingsClient />;
}

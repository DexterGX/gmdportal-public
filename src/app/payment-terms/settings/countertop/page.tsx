import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import CountertopSettingsClient from "./CountertopSettingsClient";

export default async function CountertopSettingsPage() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("paymentTerms");

  if (!user || !isActive || appRoles.length === 0) {
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

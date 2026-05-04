import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { redirect } from "next/navigation";
import PaymentTermClient from "./PaymentTermClient";

export default async function PaymentTermsPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (!["admin", "sales", "office", "finance"].includes(appRole)) {
    redirect("/dashboard");
  }

  return (
    <PaymentTermClient initialSalesRep={user.name || ""} appRole={appRole} />
  );
}

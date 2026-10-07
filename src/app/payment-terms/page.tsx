import { getProgramUserContext } from "@/lib/programPermissions";
import { redirect } from "next/navigation";
import PaymentTermClient from "./PaymentTermClient";

export default async function PaymentTermsPage() {
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("paymentTerms");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  if (!canAccess) {
    redirect("/dashboard");
  }

  return (
    <PaymentTermClient initialSalesRep={user.name || ""} appRole={appRole} />
  );
}

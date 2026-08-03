import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import CheckoutCartClient from "./CheckoutCartClient";

export default async function StoreInventoryCheckoutPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  return <CheckoutCartClient />;
}

import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import CheckoutCartClient from "./CheckoutCartClient";

export default async function StoreInventoryCheckoutPage() {
  const { user, isActive, appRoles } = await getProgramUserContext("storeInventory");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  return <CheckoutCartClient />;
}

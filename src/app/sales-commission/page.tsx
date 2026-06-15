import { getCurrentUserWithRole } from "@/lib/authHelpers";
import SalesCommissionClient from "./SalesCommissionClient";

export default async function SalesCommissionPage() {
  const { appRole } = await getCurrentUserWithRole();
  return <SalesCommissionClient appRole={appRole} />;
}

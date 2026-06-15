import { getCurrentUserWithRole } from "@/lib/authHelpers";
import CommissionPeriodsClient from "./CommissionPeriodsClient";

export default async function CommissionPeriodsPage() {
  const { appRole } = await getCurrentUserWithRole();
  return <CommissionPeriodsClient appRole={appRole} />;
}

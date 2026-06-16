import { getCurrentUserWithRole } from "@/lib/authHelpers";
import SalesCommissionClient from "./SalesCommissionClient";

export default async function SalesCommissionPage({
  searchParams,
}: {
  searchParams?: Promise<{ periodId?: string }>;
}) {
  const { appRole } = await getCurrentUserWithRole();
  const resolved = (await searchParams) || {};
  const initialPeriodId =
    typeof resolved.periodId === "string" && resolved.periodId.trim()
      ? resolved.periodId.trim()
      : null;

  return (
    <SalesCommissionClient
      appRole={appRole}
      initialPeriodId={initialPeriodId}
    />
  );
}

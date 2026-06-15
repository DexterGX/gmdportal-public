import { getCurrentUserWithRole } from "@/lib/authHelpers";
import ClosedInvoicesClient from "./ClosedInvoicesClient";

export default async function ClosedInvoicesPage() {
  const { appRole } = await getCurrentUserWithRole();
  return <ClosedInvoicesClient appRole={appRole} />;
}

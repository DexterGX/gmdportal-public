import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import ClosedInvoicesClient from "./ClosedInvoicesClient";

const p = prisma as any;

export default async function ClosedPage() {
  const session = await getServerSession(authOptions);
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!session || !user || !isActive || appRole === "unassigned")
    redirect("/login");

  const invoices = await p.cMSClosedInvoice.findMany({
    orderBy: { closedAt: "desc" },
  });

  return (
    <ClosedInvoicesClient invoices={JSON.parse(JSON.stringify(invoices))} />
  );
}

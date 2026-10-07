import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import ClosedInvoicesClient from "./ClosedInvoicesClient";

const p = prisma as any;

export default async function ClosedPage() {
  const session = await getServerSession(authOptions);
  const { user, isActive, appRoles } = await getProgramUserContext("salesCommission");
  if (!session || !user || !isActive || appRoles.length === 0)
    redirect("/login");

  const invoices = await p.cMSClosedInvoice.findMany({
    orderBy: { closedAt: "desc" },
  });

  return (
    <ClosedInvoicesClient invoices={JSON.parse(JSON.stringify(invoices))} />
  );
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import CommissionPeriodsClient from "./CommissionPeriodsClient";

const p = prisma as any;

export default async function PeriodsPage() {
  const session = await getServerSession(authOptions);
  const { user, isActive, appRoles } = await getProgramUserContext("salesCommission");
  if (!session || !user || !isActive || appRoles.length === 0)
    redirect("/login");

  const weeks = await p.cMSWeek.findMany({
    orderBy: { weekStart: "desc" },
    include: {
      invoices: { orderBy: [{ salesRep: "asc" }, { invoiceNumber: "asc" }] },
    },
  });

  return <CommissionPeriodsClient weeks={JSON.parse(JSON.stringify(weeks))} />;
}

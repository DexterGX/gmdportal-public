import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import CommissionPeriodsClient from "./CommissionPeriodsClient";

const p = prisma as any;

export default async function PeriodsPage() {
  const session = await getServerSession(authOptions);
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!session || !user || !isActive || appRole === "unassigned")
    redirect("/login");

  const weeks = await p.cMSWeek.findMany({
    orderBy: { weekStart: "desc" },
    include: {
      invoices: { orderBy: [{ salesRep: "asc" }, { invoiceNumber: "asc" }] },
    },
  });

  return <CommissionPeriodsClient weeks={JSON.parse(JSON.stringify(weeks))} />;
}

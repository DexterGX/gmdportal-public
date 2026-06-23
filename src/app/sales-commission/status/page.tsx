import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import SalesRepStatusClient from "./SalesRepStatusClient";

const p = prisma as any;

export default async function SalesCommissionStatusPage() {
  const session = await getServerSession(authOptions);
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!session || !user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  const approvedWeeks = await p.cMSWeek.findMany({
    where: { status: "APPROVED" },
    orderBy: { checkDate: "desc" },
    include: {
      invoices: {
        orderBy: [
          { sortOrder: "asc" },
          { salesRep: "asc" },
          { invoiceNumber: "asc" },
        ],
      },
    },
  });

  return (
    <SalesRepStatusClient
      weeks={JSON.parse(JSON.stringify(approvedWeeks))}
      initialUserName={user.name || ""}
    />
  );
}

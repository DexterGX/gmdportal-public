import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import SalesRepStatusClient from "./SalesRepStatusClient";

const p = prisma as any;

export default async function SalesCommissionStatusPage() {
  const session = await getServerSession(authOptions);
  const { user, isActive, appRoles } = await getProgramUserContext("salesCommission");

  if (!session || !user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  const [approvedWeeks, settings] = await Promise.all([
    p.cMSWeek.findMany({
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
    }),
    p.cMSSettings.findFirst(),
  ]);

  return (
    <SalesRepStatusClient
      weeks={JSON.parse(JSON.stringify(approvedWeeks))}
      initialUserName={user.name || ""}
      settings={settings ? JSON.parse(JSON.stringify(settings)) : null}
    />
  );
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import SalesCommissionClient from "../SalesCommissionClient";

const p = prisma as any;

export default async function DraftPage() {
  const session = await getServerSession(authOptions);
  const { user, isActive, appRoles } = await getProgramUserContext("salesCommission");
  if (!session || !user || !isActive || appRoles.length === 0)
    redirect("/login");

  const [settings, activeWeek] = await Promise.all([
    p.cMSSettings.findFirst(),
    p.cMSWeek.findFirst({
      where: { status: { in: ["DRAFT", "REVIEW"] } },
      include: {
        invoices: {
          orderBy: [
            { sortOrder: "asc" },
            { salesRep: "asc" },
            { invoiceNumber: "asc" },
          ],
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <SalesCommissionClient
      initialUserName={user.name || ""}
      initialSettings={
        settings ?? {
          id: "",
          firstPaymentPercent: 60,
          secondPaymentPercent: 40,
          minWeeklyPay: 560,
          colorPending: "#FFFFFF",
          colorFirstPayment: "#BFDBFE",
          colorFirstPaid: "#F0F9FF",
          colorClosing: "#BBF7D0",
          colorHold: "#FEF08A",
          colorHoldSignature: "#FBCFE8",
          colorError: "#FECACA",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      }
      initialActiveWeek={
        activeWeek ? JSON.parse(JSON.stringify(activeWeek)) : null
      }
      initialApprovedWeeks={[]}
      mode="draft"
    />
  );
}

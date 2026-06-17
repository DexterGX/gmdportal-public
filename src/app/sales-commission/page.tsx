import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import SalesCommissionClient from "./SalesCommissionClient";

const p = prisma as any;

export default async function SalesCommissionPage() {
  const session = await getServerSession(authOptions);
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!session || !user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  const [settings, activeWeek, approvedWeeks] = await Promise.all([
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
    p.cMSWeek.findMany({
      where: { status: "APPROVED" },
      orderBy: { weekStart: "desc" },
      take: 12,
    }),
  ]);

  const safeSettings = settings ?? {
    id: "",
    firstPaymentPercent: 60,
    secondPaymentPercent: 40,
    colorPending: "#FFFFFF",
    colorFirstPayment: "#BFDBFE",
    colorFirstPaid: "#F0F9FF",
    colorClosing: "#BBF7D0",
    colorHold: "#FEF08A",
    colorHoldSignature: "#FBCFE8",
    colorError: "#FECACA",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <SalesCommissionClient
      initialUserName={user.name || ""}
      initialSettings={safeSettings}
      initialActiveWeek={
        activeWeek ? JSON.parse(JSON.stringify(activeWeek)) : null
      }
      initialApprovedWeeks={JSON.parse(JSON.stringify(approvedWeeks))}
      mode="main"
    />
  );
}

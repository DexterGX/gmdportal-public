import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import SalesCommissionClient from "./SalesCommissionClient";

const p = prisma as any;

export default async function SalesCommissionPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);
  const { user, isActive, appRoles } = await getProgramUserContext("salesCommission");
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const viewWeekIdRaw = resolvedSearchParams?.viewWeekId;
  const openDraftRaw = resolvedSearchParams?.openDraft;
  const viewWeekId = Array.isArray(viewWeekIdRaw)
    ? viewWeekIdRaw[0]
    : viewWeekIdRaw;
  const openDraft = Array.isArray(openDraftRaw)
    ? openDraftRaw[0] === "1"
    : openDraftRaw === "1";

  if (!session || !user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  const [settings, activeWeek, approvedWeeks, latestApprovedWeek, viewWeek] =
    await Promise.all([
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
      p.cMSWeek.findFirst({
        where: { status: "APPROVED" },
        orderBy: { weekStart: "desc" },
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
      viewWeekId
        ? p.cMSWeek.findUnique({
            where: { id: viewWeekId },
            include: {
              invoices: {
                orderBy: [
                  { sortOrder: "asc" },
                  { salesRep: "asc" },
                  { invoiceNumber: "asc" },
                ],
              },
            },
          })
        : Promise.resolve(null),
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

  const shouldOpenActiveDraft = openDraft && !viewWeekId;
  const effectiveActiveWeek = shouldOpenActiveDraft ? activeWeek : null;

  return (
    <SalesCommissionClient
      initialUserName={user.name || ""}
      initialSettings={safeSettings}
      initialActiveWeek={
        effectiveActiveWeek
          ? JSON.parse(JSON.stringify(effectiveActiveWeek))
          : null
      }
      initialApprovedWeeks={JSON.parse(JSON.stringify(approvedWeeks))}
      initialLatestApprovedWeek={
        latestApprovedWeek
          ? JSON.parse(JSON.stringify(latestApprovedWeek))
          : null
      }
      initialViewWeek={viewWeek ? JSON.parse(JSON.stringify(viewWeek)) : null}
      mode="main"
    />
  );
}

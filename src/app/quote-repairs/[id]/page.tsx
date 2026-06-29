import { redirect, notFound } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import QuoteRepairDetailClient from "./QuoteRepairDetailClient";

export default async function QuoteRepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") redirect("/login");
  if (!["admin", "sales", "office", "finance"].includes(appRole))
    redirect("/dashboard");

  const repair = await prisma.quoteRepair.findUnique({
    where: { id },
    include: {
      salesRep: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      currentVersion: {
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          createdBy: { select: { id: true, name: true, email: true } },
          updatedBy: { select: { id: true, name: true, email: true } },
          submittedBy: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      },
      approvedVersion: {
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          createdBy: { select: { id: true, name: true, email: true } },
          updatedBy: { select: { id: true, name: true, email: true } },
          submittedBy: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      },
      versions: {
        where: { deletedAt: null },
        orderBy: { versionNumber: "desc" },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          createdBy: { select: { id: true, name: true, email: true } },
          updatedBy: { select: { id: true, name: true, email: true } },
          submittedBy: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!repair) notFound();

  return (
    <QuoteRepairDetailClient
      repair={JSON.parse(JSON.stringify(repair))}
      userId={user.id}
      userRole={appRole}
    />
  );
}

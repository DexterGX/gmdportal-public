import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { QUOTE_REPAIR_SERVICE_DEFAULTS } from "@/lib/quoteRepairs";
import QuoteRepairVersionClient from "./QuoteRepairVersionClient";

type PageProps = {
  params: Promise<{ id: string; versionId: string }>;
};

export default async function QuoteRepairVersionPage({ params }: PageProps) {
  const { id, versionId } = await params;
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") redirect("/login");
  if (!["admin", "sales", "office", "finance"].includes(appRole)) {
    redirect("/dashboard");
  }

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
    },
  });

  if (!repair) notFound();

  if (
    appRole === "sales" &&
    repair.salesRepId !== user.id &&
    repair.createdById !== user.id
  ) {
    redirect("/quote-repairs");
  }

  const requestedVersion = repair.versions.find(
    (entry) => entry.id === versionId,
  );
  if (!requestedVersion) {
    notFound();
  }

  let services = await prisma.quoteRepairService.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  if (services.length === 0) {
    await prisma.quoteRepairService.createMany({
      data: QUOTE_REPAIR_SERVICE_DEFAULTS.map((name, index) => ({
        name,
        active: true,
        sortOrder: index + 1,
      })),
      skipDuplicates: true,
    });

    services = await prisma.quoteRepairService.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    });
  }

  return (
    <QuoteRepairVersionClient
      repair={JSON.parse(JSON.stringify(repair))}
      versionId={versionId}
      services={services}
      userId={user.id}
      userRole={appRole}
    />
  );
}

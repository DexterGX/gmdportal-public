import { redirect, notFound } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import QuoteRepairDetailClient from "./QuoteRepairDetailClient";

export default async function QuoteRepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("quoteRepairs");

  if (!user || !isActive || appRoles.length === 0) redirect("/login");
  if (!canAccess)
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

  const companyCamUrl = await resolveCompanyCamUrl(
    repair.pipedriveDealId,
    repair.pipedrivePersonId,
  );

  return (
    <QuoteRepairDetailClient
      repair={JSON.parse(JSON.stringify(repair))}
      companyCamUrl={companyCamUrl}
      userId={user.id}
      userRole={appRole}
    />
  );
}

function toCompanyCamUrl(job: {
  companyCamUrl: string | null;
  companyCamId: string | null;
}): string | null {
  const url = job.companyCamUrl?.trim();
  if (url && /^https?:\/\//i.test(url)) return url;
  const id = job.companyCamId?.trim();
  if (id && /^\d+$/.test(id)) return `https://app.companycam.com/projects/${id}`;
  return null;
}

/**
 * Finds the CompanyCam project for this repair's customer.
 * 1) The Job synced from the linked Pipedrive deal.
 * 2) Otherwise the customer's (Pipedrive person) jobs — only when they point
 *    to a single CompanyCam project, so we never guess between projects.
 */
async function resolveCompanyCamUrl(
  pipedriveDealId: string | null,
  pipedrivePersonId: string | null,
): Promise<string | null> {
  const select = { companyCamUrl: true, companyCamId: true } as const;

  if (pipedriveDealId) {
    const job = await prisma.job.findUnique({
      where: { pipedriveId: pipedriveDealId },
      select,
    });
    const url = job ? toCompanyCamUrl(job) : null;
    if (url) return url;
  }

  if (pipedrivePersonId) {
    const jobs = await prisma.job.findMany({
      where: {
        customer: { pipedriveId: pipedrivePersonId },
        OR: [{ companyCamUrl: { not: null } }, { companyCamId: { not: null } }],
      },
      select,
    });
    const urls = Array.from(
      new Set(jobs.map(toCompanyCamUrl).filter((u): u is string => !!u)),
    );
    if (urls.length === 1) return urls[0];
  }

  return null;
}

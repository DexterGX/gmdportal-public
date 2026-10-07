import { redirect } from "next/navigation";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import ClosetJobDetailClient from "./ClosetJobDetailClient";

type ClosetJobDetailPageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function ClosetJobDetailPage(
  props: ClosetJobDetailPageProps
) {
  const { jobId } = await props.params;
  const { user, appRole, isActive, appRoles, canAccess } = await getProgramUserContext("closetJobs");

  if (!user || !isActive || appRoles.length === 0) {
    redirect("/login");
  }

  // Access is managed in Settings → Program Access
  if (!canAccess) {
    redirect("/dashboard");
  }

  // Fetch job with details
  const job = await prisma.closetJob.findUnique({
    where: { id: jobId },
    include: {
      quotes: {
        include: {
          files: true,
          installer: {
            select: { id: true, name: true, email: true },
          },
          submittedBy: {
            select: { id: true, name: true, email: true },
          },
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!job) {
    redirect("/closet-jobs");
  }

  // If user is installer, verify they are assigned to this job
  if (appRole === "installer" && job.installerId !== user.id) {
    redirect("/closet-jobs");
  }

  // Fetch user details for sales person and installer
  const [salesPerson, installer] = await Promise.all([
    prisma.user.findUnique({
      where: { id: job.salesPersonId },
      select: { id: true, name: true, email: true },
    }),
    prisma.user.findUnique({
      where: { id: job.installerId },
      select: { id: true, name: true, email: true },
    }),
  ]);

  // Serialize data
  const jobData = {
    ...job,
    createdAt: job.createdAt.toISOString(),
    quoteStartedAt: job.quoteStartedAt.toISOString(),
    quotes: job.quotes.map((q: (typeof job.quotes)[0]) => ({
      ...q,
      installerCost: q.installerCost.toString(),
      gmFactor: q.gmFactor?.toString() || null,
      finalPrice: q.finalPrice.toString(),
      createdAt: q.createdAt.toISOString(),
      submittedAt: q.submittedAt?.toISOString() || null,
      approvedAt: q.approvedAt?.toISOString() || null,
      lastPrintedAt: q.lastPrintedAt?.toISOString() || null,
      installer: q.installer || null,
      submittedBy: q.submittedBy || null,
      approvedBy: q.approvedBy || null,
      files: q.files.map((f: Prisma.ClosetQuoteFileGetPayload<{}>) => ({
        ...f,
        uploadedAt: f.uploadedAt.toISOString(),
      })),
    })),
    salesPerson: salesPerson || null,
    installer: installer || null,
  };

  return (
    <ClosetJobDetailClient job={jobData} userRole={appRole} userId={user.id} />
  );
}

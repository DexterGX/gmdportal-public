import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import JobDetailClient from "./JobDetailClient";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { appRole } = await getCurrentUserWithRole();

  // Restrict access to authenticated users
  if (!appRole) {
    redirect("/login");
  }

  const { jobId } = await params;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: true,
      closetJob: {
        include: {
          quotes: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      },
      artifacts: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!job) {
    redirect("/customers");
  }

  // Serialize Decimal fields
  const serializedJob = {
    ...job,
    jobNumber: job.jobNumber,
    value: job.value?.toNumber() || null,
    customer: {
      ...job.customer,
      balance: job.customer.balance?.toNumber() || null,
    },
    closetJob: job.closetJob
      ? {
          ...job.closetJob,
          quotes: job.closetJob.quotes.map((q) => ({
            ...q,
            installerCost: q.installerCost.toNumber(),
            gmFactor: q.gmFactor?.toNumber() || null,
            finalPrice: q.finalPrice.toNumber(),
          })),
        }
      : null,
  };

  return <JobDetailClient job={serializedJob} userRole={appRole} />;
}

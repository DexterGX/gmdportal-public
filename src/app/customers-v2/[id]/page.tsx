import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CustomerV2DetailClient from "./CustomerV2DetailClient";

export default async function CustomerV2DetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { appRole } = await getProgramUserContext("customersV2");
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          jobNumber: true,
          jobName: true,
          dealTitle: true,
          status: true,
          value: true,
          jobType: true,
          stageId: true,
          closeDate: true,
          expectedCloseDate: true,
          propertyAddress: true,
          companyCamId: true,
          companyCamUrl: true,
          quickbooksUrl: true,
          quickbooksJobId: true,
          pipedriveId: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      closetJobs: {
        orderBy: { createdAt: "desc" },
        include: {
          quotes: {
            select: {
              id: true,
              quoteCode: true,
              status: true,
              finalPrice: true,
            },
          },
        },
      },
    },
  });

  if (!customer) notFound();

  // For contractors: find all clients referred by this org
  let referredClients: Array<{
    id: string;
    displayName: string;
    email: string | null;
    phone: string | null;
    active: boolean;
    type: string;
    jobs: Array<{
      id: string;
      jobNumber: number;
      jobName: string;
      status: string;
      value: number | null;
      jobType: string | null;
    }>;
  }> = [];

  if (customer.type === "CONTRACTOR" && customer.pipedriveId) {
    const orgPipedriveId = customer.pipedriveId.replace(/^org_/, "");
    const rawClients = await prisma.customer.findMany({
      where: { referredByOrgPipedriveId: orgPipedriveId },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        active: true,
        type: true,
        jobs: {
          select: {
            id: true,
            jobNumber: true,
            jobName: true,
            status: true,
            value: true,
            jobType: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    referredClients = rawClients.map((c) => ({
      ...c,
      jobs: c.jobs.map((j) => ({
        ...j,
        value: (j.value as any)?.toNumber?.() ?? j.value,
      })),
    })) as any;
  }

  const latestJobUpdatedAt =
    customer.jobs.length > 0
      ? customer.jobs.reduce<Date>((latest, job) => {
          const jobUpdatedAt = new Date(job.updatedAt);
          return jobUpdatedAt > latest ? jobUpdatedAt : latest;
        }, new Date(customer.jobs[0].updatedAt))
      : null;

  // Serialize
  const serialized = {
    ...customer,
    lastSyncedAt: latestJobUpdatedAt ?? customer.lastSyncedAt,
    balance: customer.balance?.toNumber() ?? null,
    jobs: customer.jobs.map((j) => ({
      ...j,
      value: (j.value as any)?.toNumber?.() ?? null,
    })),
    closetJobs: customer.closetJobs.map((cj) => ({
      ...cj,
      quotes: cj.quotes.map((q) => ({
        ...q,
        finalPrice: (q.finalPrice as any)?.toNumber?.() ?? 0,
      })),
    })),
  };

  return (
    <CustomerV2DetailClient
      customer={serialized as any}
      referredClients={referredClients}
      userRole={appRole}
    />
  );
}

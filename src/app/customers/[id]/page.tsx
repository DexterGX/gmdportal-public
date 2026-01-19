import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CustomerDetailClient from "./CustomerDetailClient";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { appRole } = await getCurrentUserWithRole();
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      jobs: {
        orderBy: {
          createdAt: "desc",
        },
      },
      closetJobs: {
        orderBy: {
          createdAt: "desc",
        },
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

  if (!customer) {
    notFound();
  }

  // Serialize Decimal fields
  const serializedCustomer = {
    ...customer,
    balance: customer.balance?.toNumber() || null,
    jobs: customer.jobs.map((job) => ({
      ...job,
      value: job.value?.toNumber() || null,
    })),
    closetJobs: customer.closetJobs.map((job) => ({
      ...job,
      quotes: job.quotes.map((quote) => ({
        ...quote,
        finalPrice: quote.finalPrice.toNumber(),
      })),
    })),
  };

  return <CustomerDetailClient customer={serializedCustomer} userRole={appRole} />;
}

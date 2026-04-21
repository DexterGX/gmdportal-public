import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SavedEstimatesClient from "./SavedEstimatesClient";

export const metadata = {
  title: "Saved Estimates – Miscellaneous Estimate",
};

export default async function SavedEstimatesPage() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();

  if (!user || !isActive || appRole === "unassigned") {
    redirect("/login");
  }

  if (!["admin", "sales", "office"].includes(appRole)) {
    redirect("/dashboard");
  }

  const artifacts = await prisma.jobArtifact.findMany({
    where: { sourceApp: "MISC_ESTIMATE" },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      metadata: true,
      createdAt: true,
      job: {
        select: {
          id: true,
          dealTitle: true,
          jobName: true,
          customer: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      },
    },
  });

  const estimates = artifacts.map((a) => {
    const meta = (a.metadata ?? {}) as Record<string, unknown>;
    return {
      id: a.id,
      estimateNumber: (meta.estimateNumber as string) ?? "",
      title: (meta.title as string) ?? a.title,
      customerName:
        (meta.customerName as string) ?? a.job.customer?.displayName ?? "-",
      customerId: (meta.customerId as string) ?? a.job.customer?.id ?? null,
      dealName:
        (meta.dealName as string) ?? a.job.dealTitle ?? a.job.jobName ?? "-",
      jobId: a.job.id,
      address: (meta.address as string) ?? null,
      contractor: (meta.contractor as string) ?? null,
      date: (meta.date as string) ?? null,
      salesRep: (meta.salesRep as string) ?? null,
      selectedOptions: Array.isArray(meta.selectedOptions)
        ? (meta.selectedOptions as string[])
        : [],
      ledStripSubtotal:
        typeof meta.ledStripSubtotal === "number" ? meta.ledStripSubtotal : 0,
      savedBy: (meta.savedBy as string) ?? null,
      createdAt: a.createdAt.toISOString(),
    };
  });

  return (
    <SavedEstimatesClient
      estimates={estimates}
      currentUserName={user.name || ""}
    />
  );
}

import "server-only";
import { prisma } from "@/lib/prisma";

const prismaAny = prisma as any;

/**
 * Keeps a FabricationOrder's JobArtifact (the row that makes it show up in
 * the Customers program's job "Documents" list) in sync with the order.
 *
 * We don't duplicate the order's data into the artifact the way Payment
 * Terms / Misc Estimates snapshot themselves — Fabrication Orders already
 * have a robust, live print page at /fabrication-orders/print/[id], so the
 * artifact just needs to point at it via `url`. The Customers job page
 * already renders any artifact with a `url` set as a generic "Open" link,
 * so no changes were needed there.
 *
 * Best-effort by design: this must never block or fail an order save.
 * Returns the JobArtifact id to persist back onto the order's
 * `jobArtifactId` field (or null if there's no linked job to attach to).
 */
export async function syncFabricationOrderArtifact(params: {
  orderId: string;
  jobArtifactId: string | null;
  jobId: string | null;
  orderNumber: string | null;
  clientName: string;
  dealName: string | null;
  total: number;
  userId?: string | null;
}): Promise<string | null> {
  const { orderId, jobArtifactId, jobId, orderNumber, clientName, dealName, total, userId } =
    params;

  const title = `Fabrication Order ${orderNumber || ""} - ${clientName}`.trim();
  const url = `/fabrication-orders/print/${orderId}`;
  const metadata = {
    fabricationOrderId: orderId,
    orderNumber,
    clientName,
    dealName,
    total,
  };

  try {
    if (!jobId) {
      // No linked job/deal — nothing to show in the Customers program.
      // Clean up a stale artifact from a prior save, if any.
      if (jobArtifactId) {
        await prismaAny.jobArtifact.delete({ where: { id: jobArtifactId } }).catch(() => {});
      }
      return null;
    }

    if (jobArtifactId) {
      const updated = await prismaAny.jobArtifact
        .update({
          where: { id: jobArtifactId },
          data: { jobId, title, url, metadata },
        })
        .catch(() => null);
      if (updated) return updated.id;
      // Artifact no longer exists (e.g. manually removed) — fall through and recreate it.
    }

    const created = await prismaAny.jobArtifact.create({
      data: {
        jobId,
        sourceApp: "FABRICATION_ORDER",
        type: "ORDER",
        title,
        url,
        metadata,
        createdByUserId: userId || null,
      },
    });
    return created.id;
  } catch (err) {
    console.error("Failed to sync fabrication order JobArtifact", err);
    return jobArtifactId;
  }
}

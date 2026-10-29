import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

const MAX_CHAIN = 25;

/**
 * History of an estimate. A changed estimate is saved as a new version with a
 * new Estimate # (its first history row says which number it came from, and
 * the older one gets an "edited in" row), so the history walks the whole chain
 * of versions - older and newer - and every entry is tagged with the
 * Estimate # it belongs to. Opening the history of any version shows the same
 * list.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, isActive, appRoles } = await getProgramUserContext("cabinetEstimates");
  if (!user || !isActive || appRoles.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const out: any[] = [];
  const seen = new Set<string>();
  const queue: string[] = [id];

  while (queue.length > 0 && seen.size < MAX_CHAIN) {
    const currentId = queue.shift() as string;
    if (seen.has(currentId)) continue;
    seen.add(currentId);

    const estimate: { estimateNumber: string } | null = await prismaAny.cabinetEstimate.findUnique({
      where: { id: currentId },
      select: { estimateNumber: true },
    });
    if (!estimate) continue;

    const entries: any[] = await prismaAny.cabinetEstimateHistory.findMany({
      where: { estimateId: currentId },
      orderBy: { createdAt: "desc" },
      include: { changedByUser: { select: { name: true, email: true } } },
    });
    for (const entry of entries) {
      out.push({ ...entry, estimateNumber: estimate.estimateNumber });
    }

    // Neighbours: the version this one was edited from, and versions edited from it.
    const numbers = new Set<string>();
    for (const entry of entries) {
      if (entry.action === "CREATED" && entry.fieldName === "revisionOf" && entry.oldValue) {
        numbers.add(entry.oldValue);
      }
      if (
        (entry.action === "REVISED" || entry.action === "ARCHIVED") &&
        entry.fieldName === "replacedBy" &&
        entry.newValue
      ) {
        numbers.add(entry.newValue);
      }
    }
    for (const estimateNumber of Array.from(numbers)) {
      const neighbour: { id: string } | null = await prismaAny.cabinetEstimate.findFirst({
        where: { estimateNumber },
        select: { id: true },
      });
      if (neighbour) queue.push(neighbour.id);
    }
  }

  out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return NextResponse.json(out);
}

import { prisma } from "@/lib/prisma";

const prismaAny = prisma as any;

const PREFIX = "CE";

// "CE" + YYMM + a 3-digit sequence derived from the max existing number in
// the month (not a raw count), so a deleted/archived estimate mid-month
// can't cause a collision. Mirrors generateMonthlyFabOrderNumber().
export async function generateMonthlyCabinetEstimateNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const monthToken = `${PREFIX}${yy}${mm}`;

  const monthEstimates = await prismaAny.cabinetEstimate.findMany({
    where: { estimateNumber: { startsWith: monthToken } },
    select: { estimateNumber: true },
    take: 5000,
  });

  let maxSequence = 0;
  const pattern = new RegExp(`^${monthToken}(\\d+)$`);
  for (const estimate of monthEstimates) {
    const match = String(estimate.estimateNumber ?? "").match(pattern);
    if (!match) continue;
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) maxSequence = Math.max(maxSequence, parsed);
  }

  const seq = String(maxSequence + 1).padStart(3, "0");
  return `${monthToken}${seq}`;
}

export function isEstimateNumberUniqueConstraintError(error: any): boolean {
  if (error?.code !== "P2002") return false;
  const target = error?.meta?.target;
  if (Array.isArray(target)) return target.includes("estimateNumber");
  if (typeof target === "string") return target.includes("estimateNumber");
  return false;
}

import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { canViewQuoteRepair } from "@/lib/quoteRepairs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { user, appRole } = await getCurrentUserWithRole();
  if (!user || appRole === "unassigned") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewQuoteRepair(appRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const repair = await prisma.quoteRepair.findUnique({ where: { id }, include: { currentVersion: { include: { items: true } } } });
  if (!repair?.currentVersion) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (appRole === "sales" && repair.salesRepId !== user.id && repair.createdById !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.quoteRepairVersion.update({
    where: { id: repair.currentVersion.id },
    data: { status: "SUBMITTED", submittedById: user.id, submittedAt: new Date() },
  });
  await prisma.quoteRepair.update({ where: { id }, data: { status: "SUBMITTED" } });
  await prisma.quoteRepairActivity.create({ data: { quoteRepairId: id, quoteRepairVersionId: repair.currentVersion.id, actorUserId: user.id, action: "SUBMITTED" } });
  return NextResponse.json({ ok: true });
}

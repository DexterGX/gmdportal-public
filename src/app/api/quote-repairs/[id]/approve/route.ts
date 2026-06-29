import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { user, appRole } = await getCurrentUserWithRole();
  if (!user || appRole !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const repair = await prisma.quoteRepair.findUnique({ where: { id }, include: { currentVersion: { include: { items: true } } } });
  if (!repair?.currentVersion) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const currentVersionId = repair.currentVersion.id;

  const approvedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.quoteRepairVersion.update({ where: { id: currentVersionId }, data: { status: "APPROVED", approvedById: user.id, approvedAt } });
    await tx.quoteRepair.update({ where: { id }, data: { status: "APPROVED", approvedVersionId: currentVersionId } });
    await tx.quoteRepairActivity.create({ data: { quoteRepairId: id, quoteRepairVersionId: currentVersionId, actorUserId: user.id, action: "APPROVED" } });
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";


export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { user, appRole, appRoles, canAccess } = await getProgramUserContext("quoteRepairs");
  if (!user || appRoles.length === 0) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

import { NextResponse } from "next/server";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { user, appRole } = await getProgramUserContext("quoteRepairs");
  if (!user || appRole !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.quoteRepair.update({ where: { id }, data: { archivedAt: new Date(), status: "ARCHIVED" } });
  await prisma.quoteRepairActivity.create({ data: { quoteRepairId: id, actorUserId: user.id, action: "ARCHIVED" } });
  return NextResponse.json({ ok: true });
}

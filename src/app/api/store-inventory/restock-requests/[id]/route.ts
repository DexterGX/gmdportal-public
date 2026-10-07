import { NextRequest, NextResponse } from "next/server";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { canActionRestockRequests } from "@/lib/storeInventory";

const VALID_STATUSES = ["ORDERED", "RECEIVED", "CANCELED"] as const;

// Explicit allowed transitions out of each status. REQUESTED can move to
// ORDERED or CANCELED; ORDERED can move to RECEIVED or CANCELED; RECEIVED
// and CANCELED are terminal.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ["ORDERED", "CANCELED"],
  ORDERED: ["RECEIVED", "CANCELED"],
  RECEIVED: [],
  CANCELED: [],
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { user, appRole } = await getProgramUserContext("storeInventory");
  if (!user || !canActionRestockRequests(appRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const status = body?.status;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const existing = await prisma.storeRestockRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  const allowedNext = ALLOWED_TRANSITIONS[existing.status] ?? [];
  if (!allowedNext.includes(status)) {
    const reason =
      existing.status === "RECEIVED" || existing.status === "CANCELED"
        ? `Request is already ${existing.status.toLowerCase()}`
        : `Request must be ordered before it can be received`;
    return NextResponse.json({ error: reason }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (status === "RECEIVED") {
      const item = await tx.storeItem.findUnique({ where: { id: existing.itemId } });
      if (!item) throw new Error("Item not found");

      const newQuantity = item.quantity + existing.requestedQty;

      await tx.storeItem.update({ where: { id: item.id }, data: { quantity: newQuantity } });

      await tx.storeInventoryTransaction.create({
        data: {
          itemId: item.id,
          itemName: item.name,
          itemUnit: item.unit,
          type: "RESTOCK_RECEIVED",
          change: existing.requestedQty,
          oldQuantity: item.quantity,
          newQuantity,
          reason: `Restock request received (${existing.requestedQty} ${item.unit})`,
          userId: user.id,
        },
      });
    }

    return tx.storeRestockRequest.update({
      where: { id: existing.id },
      data: {
        status,
        actionedByUserId: user.id,
        actionedAt: new Date(),
      },
      include: {
        item: { include: { department: true, group: true } },
        requestedByUser: { select: { id: true, name: true, email: true } },
        actionedByUser: { select: { id: true, name: true, email: true } },
      },
    });
  });

  return NextResponse.json(updated);
}

import { NextRequest, NextResponse } from "next/server";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { user, appRoles } = await getProgramUserContext("storeInventory");
  if (!user || appRoles.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const qty = Number(body?.quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "Quantity must be greater than 0" }, { status: 400 });
  }
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : null;

  try {
    const newQuantity = await prisma.$transaction(async (tx) => {
      const item = await tx.storeItem.findUnique({ where: { id } });
      if (!item) throw new Error("NOT_FOUND");

      const updatedQuantity = item.quantity + qty;

      await tx.storeItem.update({
        where: { id: item.id },
        data: { quantity: updatedQuantity },
      });

      await tx.storeInventoryTransaction.create({
        data: {
          itemId: item.id,
          itemName: item.name,
          itemUnit: item.unit,
          type: "RETURN",
          change: qty,
          oldQuantity: item.quantity,
          newQuantity: updatedQuantity,
          reason,
          userId: user.id,
        },
      });

      return updatedQuantity;
    });

    return NextResponse.json({ ok: true, newQuantity });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to return item" }, { status: 500 });
  }
}

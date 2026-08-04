import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";

type CheckoutLine = { itemId: string; quantity: number; reason?: string };

export async function POST(request: NextRequest) {
  const { user, appRole } = await getCurrentUserWithRole();
  if (!user || appRole === "unassigned") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const lines: CheckoutLine[] = Array.isArray(body?.lines) ? body.lines : [];

  if (lines.length === 0) {
    return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
  }

  const results: { itemId: string; ok: boolean; error?: string; newQuantity?: number }[] = [];

  for (const line of lines) {
    const qty = Number(line.quantity);
    if (!line.itemId || !Number.isFinite(qty) || qty <= 0) {
      results.push({ itemId: line.itemId, ok: false, error: "Invalid quantity" });
      continue;
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const item = await tx.storeItem.findUnique({ where: { id: line.itemId } });
        if (!item) throw new Error("NOT_FOUND");
        if (item.quantity < qty) throw new Error("INSUFFICIENT_STOCK");

        const newQuantity = item.quantity - qty;

        await tx.storeItem.update({
          where: { id: item.id },
          data: { quantity: newQuantity },
        });

        await tx.storeInventoryTransaction.create({
          data: {
            itemId: item.id,
            itemName: item.name,
            itemUnit: item.unit,
            type: "CHECKOUT",
            change: -qty,
            oldQuantity: item.quantity,
            newQuantity,
            reason: line.reason || null,
            userId: user.id,
          },
        });

        return newQuantity;
      });

      results.push({ itemId: line.itemId, ok: true, newQuantity: updated });
    } catch (error) {
      const message =
        error instanceof Error && error.message === "INSUFFICIENT_STOCK"
          ? "Not enough stock available"
          : error instanceof Error && error.message === "NOT_FOUND"
            ? "Item not found"
            : "Checkout failed";
      results.push({ itemId: line.itemId, ok: false, error: message });
    }
  }

  const allOk = results.every((r) => r.ok);
  return NextResponse.json({ results }, { status: allOk ? 200 : 207 });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const session = await getServerSession(authOptions as any);

  const { itemId, change, reason } = body;

  // perform transactionally
  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.stockItem.findUnique({ where: { id: itemId } });
    if (!item) throw new Error("Item not found");

    const oldQ = item.quantity;
    const newQ = oldQ + Number(change || 0);

    const t = await tx.stockTransaction.create({
      data: {
        itemId,
        userId: (session as any)?.uid ?? null,
        change: Number(change || 0),
        reason: reason ?? null,
        oldQuantity: oldQ,
        newQuantity: newQ,
      },
    });

    await tx.stockItem.update({
      where: { id: itemId },
      data: { quantity: newQ, updatedById: (session as any)?.uid ?? null },
    });

    return t;
  });

  return NextResponse.json(result, { status: 201 });
}

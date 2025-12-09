import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const txs = await prisma.stockTransaction.findMany({
    where: { itemId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(txs);
}

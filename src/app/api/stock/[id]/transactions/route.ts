import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const txs = await prisma.stockTransaction.findMany({ where: { itemId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(txs);
}

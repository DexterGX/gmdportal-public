import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const category = searchParams.get("category") ?? undefined;

  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ];
  }
  if (category) where.category = category;

  const items = await prisma.stockItem.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions as any);
  const body = await request.json();

  const created = await prisma.stockItem.create({
    data: {
      name: body.name,
      category: body.category,
      unit: body.unit,
      quantity: body.quantity ?? 0,
      minQuantity: body.minQuantity ?? 0,
      providor: body.providor ?? null,
      notes: body.notes ?? null,
      updatedById: (session as any)?.uid ?? null,
    },
  });

  return NextResponse.json(created, { status: 201 });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await prisma.stockItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const session = await getServerSession(authOptions as any);

  const updated = await prisma.stockItem.update({
    where: { id },
    data: {
      name: body.name,
      category: body.category,
      unit: body.unit,
      quantity: body.quantity ?? undefined,
      minQuantity: body.minQuantity ?? undefined,
      providor: body.providor ?? undefined,
      notes: body.notes ?? undefined,
      updatedById: (session as any)?.uid ?? undefined,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.stockItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

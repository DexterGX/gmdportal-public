import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const prismaAny = prisma as any;

    await prismaAny.sinkBrand.update({
      where: { id },
      data: {
        name: String(body?.name ?? "").trim(),
        logoUrl: body?.logoUrl ? String(body.logoUrl) : null,
        factor: new Decimal(Number(body?.factor ?? 1)),
        taxFactor: new Decimal(Number(body?.taxFactor ?? 1)),
        freight: new Decimal(Number(body?.freight ?? 0)),
        discount: new Decimal(Number(body?.discount ?? 0)),
        contactName: body?.contactName ? String(body.contactName) : null,
        contactCell: body?.contactCell ? String(body.contactCell) : null,
        contactPhone: body?.contactPhone ? String(body.contactPhone) : null,
        contactEmail: body?.contactEmail ? String(body.contactEmail) : null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update sink brand" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const prismaAny = prisma as any;

    const sinkCount = await prismaAny.sink.count({ where: { brandId: id } });
    if (sinkCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete brand while sinks still exist for this brand" },
        { status: 400 },
      );
    }

    await prismaAny.sinkBrand.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete sink brand" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { calculateSinkFinalPrice } from "@/lib/sinksPricing";

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

    const sink = await prismaAny.sink.findUnique({ where: { id } });
    if (!sink) {
      return NextResponse.json({ error: "Sink not found" }, { status: 404 });
    }

    const brandId = String(body?.brandId ?? sink.brandId).trim();
    const listedPrice = Number(body?.listedPrice ?? Number(sink.listedPrice));
    const brand = await prismaAny.sinkBrand.findUnique({
      where: { id: brandId },
    });
    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 400 });
    }

    const finalPrice = calculateSinkFinalPrice({
      listedPrice: new Decimal(listedPrice),
      factor: brand.factor,
      taxFactor: brand.taxFactor,
      freight: brand.freight,
      discount: brand.discount,
    });

    const updated = await prismaAny.sink.update({
      where: { id },
      data: {
        brandId,
        model: body?.model ? String(body.model) : sink.model,
        description:
          body?.description !== undefined
            ? body.description
              ? String(body.description)
              : null
            : sink.description,
        dimensions: body?.dimensions
          ? String(body.dimensions)
          : sink.dimensions,
        listedPrice: new Decimal(listedPrice),
        finalPrice,
        status: body?.status === "DISCONTINUED" ? "DISCONTINUED" : "AVAILABLE",
        isPromotional:
          body?.isPromotional !== undefined
            ? Boolean(body.isPromotional)
            : Boolean(sink.isPromotional),
        promotionalPrice:
          body?.isPromotional &&
          body?.promotionalPrice !== undefined &&
          body?.promotionalPrice !== null
            ? new Decimal(Number(body.promotionalPrice))
            : body?.isPromotional === false
              ? null
              : sink.promotionalPrice,
      },
    });

    return NextResponse.json({ id: updated.id });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update sink" },
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

    await prismaAny.sink.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete sink" },
      { status: 500 },
    );
  }
}

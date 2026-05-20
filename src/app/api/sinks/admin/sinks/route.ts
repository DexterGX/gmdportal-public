import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { calculateSinkFinalPrice } from "@/lib/sinksPricing";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const brandId = String(body?.brandId ?? "").trim();
    const series = body?.series ? String(body.series).trim() : null;
    const model = String(body?.model ?? "").trim();
    const dimensions = String(body?.dimensions ?? "").trim();
    const listedPrice = Number(body?.listedPrice ?? 0);

    if (!brandId || !model || !dimensions || !Number.isFinite(listedPrice)) {
      return NextResponse.json(
        { error: "Brand, model, dimensions and numeric price are required" },
        { status: 400 },
      );
    }

    const prismaAny = prisma as any;
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

    const created = await prismaAny.sink.create({
      data: {
        brandId,
        series,
        model,
        description: body?.description ? String(body.description) : null,
        dimensions,
        listedPrice: new Decimal(listedPrice),
        finalPrice,
        status: body?.status === "DISCONTINUED" ? "DISCONTINUED" : "AVAILABLE",
        isPromotional: Boolean(body?.isPromotional),
        promotionalPrice:
          body?.isPromotional &&
          body?.promotionalPrice !== undefined &&
          body?.promotionalPrice !== null
            ? new Decimal(Number(body.promotionalPrice))
            : null,
      },
      select: { id: true },
    });

    return NextResponse.json({ id: created.id });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create sink" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/server";
import { Decimal } from "@prisma/client/runtime/library";
import { calculateSinkFinalPrice } from "@/lib/sinksPricing";

const BUCKET_NAME = process.env.SUPABASE_SINKS_BUCKET || "sinks-assets";

function extractStoragePathFromUrl(
  url: string | null | undefined,
): string | null {
  if (!url) {
    return null;
  }

  const marker = `${BUCKET_NAME}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  return url.slice(markerIndex + marker.length);
}

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
        series:
          body?.series !== undefined
            ? body.series
              ? String(body.series)
              : null
            : sink.series,
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

    const sink = await prismaAny.sink.findUnique({
      where: { id },
      select: { imageUrl: true },
    });
    if (!sink) {
      return NextResponse.json({ error: "Sink not found" }, { status: 404 });
    }

    await prismaAny.sink.delete({ where: { id } });

    const storagePath = extractStoragePathFromUrl(
      sink.imageUrl ? String(sink.imageUrl) : null,
    );
    if (storagePath) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove([storagePath]);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete sink" },
      { status: 500 },
    );
  }
}

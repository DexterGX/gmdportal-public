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
    const diff = body?.diff || {};

    const newSinks = Array.isArray(diff?.newSinks) ? diff.newSinks : [];
    const updatedSinks = Array.isArray(diff?.updatedSinks)
      ? diff.updatedSinks
      : [];
    const discontinuedSinks = Array.isArray(diff?.discontinuedSinks)
      ? diff.discontinuedSinks
      : [];

    if (!brandId) {
      return NextResponse.json({ error: "Brand is required" }, { status: 400 });
    }

    const prismaAny = prisma as any;
    const brand = await prismaAny.sinkBrand.findUnique({
      where: { id: brandId },
    });
    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 400 });
    }

    const discontinuedIds = discontinuedSinks
      .map((row: any) => String(row?.id ?? "").trim())
      .filter(Boolean);

    const discontinuedImageRows =
      discontinuedIds.length > 0
        ? await prismaAny.sink.findMany({
            where: {
              id: { in: discontinuedIds },
              brandId,
            },
            select: {
              imageUrl: true,
            },
          })
        : [];

    await prismaAny.$transaction(
      async (tx: any) => {
        for (const row of newSinks) {
          const listedPrice = Number(row?.listedPrice ?? 0);
          const finalPrice = calculateSinkFinalPrice({
            listedPrice: new Decimal(listedPrice),
            factor: brand.factor,
            taxFactor: brand.taxFactor,
            freight: brand.freight,
            discount: brand.discount,
          });
          const sinkData = {
            series: row?.series ? String(row.series).trim() : null,
            description: row?.description ? String(row.description) : null,
            listedPrice: new Decimal(listedPrice),
            finalPrice,
            status:
              row?.status === "DISCONTINUED" ? "DISCONTINUED" : "AVAILABLE",
          };

          await tx.sink.upsert({
            where: {
              brandId_model_dimensions: {
                brandId,
                model: String(row?.model ?? "").trim(),
                dimensions: String(row?.dimensions ?? "").trim(),
              },
            },
            update: {
              ...sinkData,
            },
            create: {
              brandId,
              model: String(row?.model ?? "").trim(),
              dimensions: String(row?.dimensions ?? "").trim(),
              ...sinkData,
            },
          });
        }

        for (const row of updatedSinks) {
          const sinkId = String(row?.id ?? "").trim();
          if (!sinkId) {
            continue;
          }

          const listedPrice = Number(
            row?.after?.listedPrice ?? row?.before?.listedPrice ?? 0,
          );
          const finalPrice = calculateSinkFinalPrice({
            listedPrice: new Decimal(listedPrice),
            factor: brand.factor,
            taxFactor: brand.taxFactor,
            freight: brand.freight,
            discount: brand.discount,
          });

          await tx.sink.update({
            where: { id: sinkId },
            data: {
              series: row?.after?.series
                ? String(row.after.series).trim()
                : null,
              description: row?.after?.description
                ? String(row.after.description)
                : null,
              listedPrice: new Decimal(listedPrice),
              finalPrice,
              status:
                row?.after?.status === "DISCONTINUED"
                  ? "DISCONTINUED"
                  : "AVAILABLE",
            },
          });
        }

        if (discontinuedIds.length > 0) {
          await tx.sink.deleteMany({
            where: {
              id: { in: discontinuedIds },
              brandId,
            },
          });
        }
      },
      {
        maxWait: 10_000,
        timeout: 60_000,
      },
    );

    const storagePaths = discontinuedImageRows
      .map((sink: any) =>
        extractStoragePathFromUrl(sink.imageUrl ? String(sink.imageUrl) : null),
      )
      .filter(Boolean) as string[];

    if (storagePaths.length > 0) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove(storagePaths);
    }

    return NextResponse.json({
      ok: true,
      summary: {
        created: newSinks.length,
        updated: updatedSinks.length,
        deleted: discontinuedSinks.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "An unexpected error occurred during the sink import process.",
      },
      { status: 500 },
    );
  }
}

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

    const modelNames = Array.from(
      new Set(
        [...newSinks, ...updatedSinks]
          .map((row: any) => String(row?.model ?? "").trim())
          .filter(Boolean),
      ),
    );

    const modelImages =
      modelNames.length > 0
        ? await prismaAny.sinkModelImage.findMany({
            where: {
              brandId,
              model: { in: modelNames },
            },
            select: { model: true, imageUrl: true },
          })
        : [];
    const modelImageByModel = new Map<string, string>();
    for (const row of modelImages) {
      const model = String(row?.model ?? "").trim();
      const imageUrl = typeof row?.imageUrl === "string" ? row.imageUrl : "";
      if (model && imageUrl && !modelImageByModel.has(model)) {
        modelImageByModel.set(model, imageUrl);
      }
    }

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
            imageUrl:
              modelImageByModel.get(String(row?.model ?? "").trim()) ||
              undefined,
            status:
              row?.status === "DISCONTINUED" ? "DISCONTINUED" : "AVAILABLE",
          };

          await tx.sink.upsert({
            where: {
              brandId_model_dimensions_description: {
                brandId,
                model: String(row?.model ?? "").trim(),
                dimensions: String(row?.dimensions ?? "").trim(),
                description: row?.description
                  ? String(row.description).trim()
                  : null,
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
              imageUrl:
                modelImageByModel.get(String(row?.model ?? "").trim()) ||
                undefined,
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

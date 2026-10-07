import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma, type SlabFinish, type SlabStatus, type SlabThickness } from "@prisma/client";
import { mapThicknessToEnum } from "@/lib/slabsImport";
import { SLAB_FINISH_OPTIONS } from "@/lib/slabsTemplate";
import { computeRowsDiff, requireSlabAdmin, sanitizeTemplateRows } from "@/lib/slabsImportServer";
import { isValidImportPath, removeSlabImportFile } from "@/lib/slabsImportStorage";

export const maxDuration = 60;

// Rows per bulk UPDATE statement (9 bind parameters each - well under Postgres's limit).
const UPDATE_BATCH_SIZE = 250;

function toFinish(finish: string): SlabFinish {
  return (SLAB_FINISH_OPTIONS.includes(finish) ? finish : "OTHER") as SlabFinish;
}

function toStatus(status: string): SlabStatus {
  const upper = status.toUpperCase();
  return (["AVAILABLE", "DISCONTINUED", "UNAVAILABLE"].includes(upper) ? upper : "AVAILABLE") as SlabStatus;
}

/**
 * POST /api/slabs/admin/import/apply
 * Body: { brandId, rows: SlabTemplateRow[], discontinuedIds: string[], storagePath? }
 *
 * Re-validates the reviewed rows and RE-COMPUTES the diff server-side (the
 * browser's preview is never trusted), then creates new slabs, updates
 * changed ones and marks the checked discontinued slabs UNAVAILABLE.
 * Discontinued slabs are soft-flagged, never deleted.
 */
export async function POST(request: Request) {
  try {
    if (!(await requireSlabAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const brandId = typeof body?.brandId === "string" ? body.brandId : "";
    if (!brandId) return NextResponse.json({ error: "Brand not selected" }, { status: 400 });

    const rows = sanitizeTemplateRows(body?.rows);
    const requestedDiscontinued = new Set<string>(
      Array.isArray(body?.discontinuedIds) ? body.discontinuedIds.filter((id: unknown) => typeof id === "string") : [],
    );

    const result = await computeRowsDiff(brandId, rows);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, issues: result.issues }, { status: result.status });
    }
    const { brand, diff } = result;

    // Only slabs that really are missing from this brand's new list can be discontinued.
    const discontinuedIds = diff.discontinuedSlabs
      .filter((s) => requestedDiscontinued.has(s.id))
      .map((s) => s.id);

    const maxSlab = await prisma.slab.findFirst({
      orderBy: { slabNumber: "desc" },
      select: { slabNumber: true },
    });
    let nextSlabNumber = (maxSlab?.slabNumber ?? 0) + 1;

    const newSlabsData = diff.newSlabs.map((slab) => ({
      slabNumber: nextSlabNumber++,
      brandId: brand.id,
      series: slab.series,
      providerCode: slab.code || "",
      color: slab.color,
      finish: toFinish(slab.finish),
      widthIn: new Decimal(slab.widthIn),
      heightIn: new Decimal(slab.heightIn),
      thickness: mapThicknessToEnum(slab.thickness) as SlabThickness,
      providerPrice: new Decimal(slab.listedPrice),
      finalPrice: new Decimal(slab.finalPrice),
      status: toStatus(slab.status),
    }));

    // Everything goes in ONE batch transaction with a handful of statements,
    // instead of one UPDATE round trip per slab inside an interactive
    // transaction (hundreds of round trips to Supabase blew past Prisma's
    // interactive-transaction timeout on a full price list).
    const operations: Prisma.PrismaPromise<unknown>[] = [];

    if (newSlabsData.length > 0) {
      operations.push(prisma.slab.createMany({ data: newSlabsData }));
    }

    for (let i = 0; i < diff.changedSlabs.length; i += UPDATE_BATCH_SIZE) {
      const batch = diff.changedSlabs.slice(i, i + UPDATE_BATCH_SIZE);
      const values = batch.map(({ existing, incoming }) => {
        return Prisma.sql`(${existing.id}::text, ${incoming.series}::text, ${incoming.code || ""}::text, ${String(
          incoming.widthIn,
        )}::numeric, ${String(incoming.heightIn)}::numeric, ${mapThicknessToEnum(incoming.thickness)}::text, ${String(
          incoming.listedPrice,
        )}::numeric, ${String(incoming.finalPrice)}::numeric, ${toStatus(incoming.status)}::text)`;
      });
      operations.push(
        prisma.$executeRaw`
          UPDATE "Slab" AS s SET
            "series" = v.series,
            "providerCode" = v.code,
            "widthIn" = v.width_in,
            "heightIn" = v.height_in,
            "thickness" = v.thickness::"SlabThickness",
            "providerPrice" = v.listed,
            "finalPrice" = v.final,
            "status" = v.status::"SlabStatus",
            "updatedAt" = NOW()
          FROM (VALUES ${Prisma.join(values)})
            AS v(id, series, code, width_in, height_in, thickness, listed, final, status)
          WHERE s."id" = v.id AND s."brandId" = ${brand.id}`,
      );
    }

    if (discontinuedIds.length > 0) {
      operations.push(
        prisma.slab.updateMany({
          where: { id: { in: discontinuedIds }, brandId: brand.id },
          data: { status: "UNAVAILABLE" },
        }),
      );
    }

    operations.push(
      prisma.slabBrandConfig.update({
        where: { id: brand.id },
        data: { lastUpdate: new Date() },
      }),
    );

    await prisma.$transaction(operations);

    if (isValidImportPath(body?.storagePath, brandId)) {
      await removeSlabImportFile(body.storagePath);
    }

    return NextResponse.json({
      success: true,
      message: "Import completed successfully",
      summary: {
        created: newSlabsData.length,
        updated: diff.changedSlabs.length,
        discontinued: discontinuedIds.length,
      },
    });
  } catch (error: any) {
    console.error("Import apply error:", error);
    return NextResponse.json({ error: error.message || "Failed to apply changes" }, { status: 500 });
  }
}

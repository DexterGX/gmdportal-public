import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import type { NormalizedImportSlab } from "@/lib/slabsImport";
import { mapThicknessToEnum } from "@/lib/slabsImport";
import type { SlabFinish, SlabThickness, SlabStatus } from "@prisma/client";

function mapFinishToEnum(finish: string): SlabFinish {
  const upper = finish.toUpperCase().replace(/\s/g, "_");
  return upper as SlabFinish;
}

function mapStatusToEnum(status: string): SlabStatus {
  const upper = status.toUpperCase().replace(/\s/g, "_");
  return upper as SlabStatus;
}

function mapThicknessStringToEnum(thickness: string): SlabThickness {
  const lower = thickness.toLowerCase().replace(/\s/g, "");
  switch (lower) {
    case "2cm":
      return "TWO_CM";
    case "3cm":
      return "THREE_CM";
    case "8mm":
      return "EIGHT_MM";
    case "12mm":
      return "TWELVE_MM";
    default:
      return "TWO_CM";
  }
}

type ApplyPayload = {
  newSlabs: NormalizedImportSlab[];
  changedSlabs: {
    existingId: string;
    incoming: NormalizedImportSlab;
  }[];
  discontinuedIds: string[];
};

/**
 * POST /api/slabs/admin/import/apply
 * Apply import changes to database
 */
export async function POST(request: Request) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload: ApplyPayload = await request.json();
    const { newSlabs, changedSlabs, discontinuedIds } = payload;

    let createdCount = 0;
    let updatedCount = 0;
    let discontinuedCount = 0;

    // Get brand configs before transaction
    const brandNames = new Set<string>();
    newSlabs.forEach((s) => brandNames.add(s.brand));
    changedSlabs.forEach((c) => brandNames.add(c.incoming.brand));

    const brandConfigs = await prisma.slabBrandConfig.findMany({
      where: { name: { in: Array.from(brandNames) } },
    });
    const brandConfigMap = new Map(brandConfigs.map((bc) => [bc.name, bc]));

    // Get starting slab number before transaction
    const maxSlab = await prisma.slab.findFirst({
      orderBy: { slabNumber: "desc" },
      select: { slabNumber: true },
    });
    let nextSlabNumber = (maxSlab?.slabNumber ?? 0) + 1;

    // Prepare data for batch operations
    const newSlabsData = newSlabs.map((slab) => {
      const brandConfig = brandConfigMap.get(slab.brand);
      if (!brandConfig) {
        throw new Error(`Brand config not found for: ${slab.brand}`);
      }

      return {
        slabNumber: nextSlabNumber++,
        brandId: brandConfig.id,
        series: slab.series,
        providerCode: slab.code || "",
        color: slab.color,
        finish: mapFinishToEnum(slab.finish),
        widthIn: new Decimal(slab.widthIn),
        heightIn: new Decimal(slab.heightIn),
        thickness: mapThicknessStringToEnum(slab.thickness),
        providerPrice: new Decimal(slab.listedPrice),
        finalPrice: new Decimal(slab.finalPrice),
        status: mapStatusToEnum(slab.status),
      };
    });

    // Use transaction for consistency
    await prisma.$transaction(
      async (tx) => {
        // 1. Create new slabs in batch
        if (newSlabsData.length > 0) {
          await tx.slab.createMany({
            data: newSlabsData,
          });
          createdCount = newSlabsData.length;
        }

        // 2. Update changed slabs individually (required for different data per row)
        for (const change of changedSlabs) {
          await tx.slab.update({
            where: { id: change.existingId },
            data: {
              series: change.incoming.series,
              providerCode: change.incoming.code || "",
              widthIn: new Decimal(change.incoming.widthIn),
              heightIn: new Decimal(change.incoming.heightIn),
              thickness: mapThicknessStringToEnum(change.incoming.thickness),
              providerPrice: new Decimal(change.incoming.listedPrice),
              finalPrice: new Decimal(change.incoming.finalPrice),
              status: mapStatusToEnum(change.incoming.status),
            },
          });
          updatedCount++;
        }

        // 3. Mark discontinued slabs in batch
        if (discontinuedIds.length > 0) {
          await tx.slab.updateMany({
            where: { id: { in: discontinuedIds } },
            data: { status: "UNAVAILABLE" },
          });
          discontinuedCount = discontinuedIds.length;
        }
      },
      {
        maxWait: 10000, // 10 seconds max wait
        timeout: 20000, // 20 seconds timeout
      }
    );

    return NextResponse.json({
      success: true,
      message: "Import completed successfully",
      summary: {
        created: createdCount,
        updated: updatedCount,
        discontinued: discontinuedCount,
      },
    });
  } catch (error: any) {
    console.error("Import apply error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to apply changes" },
      { status: 500 }
    );
  }
}

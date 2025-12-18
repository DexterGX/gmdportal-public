import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { computeFinalPrice } from "@/lib/slabsPricing";
import { SlabThickness } from "@prisma/client";

// Map UI thickness format to database enum
function mapThicknessToEnum(uiThickness: string): SlabThickness {
  const mapping: Record<string, SlabThickness> = {
    "8mm": "EIGHT_MM",
    "12mm": "TWELVE_MM",
    "15mm": "FIFTEEN_MM",
    "2cm": "TWO_CM",
    "3cm": "THREE_CM",
  };
  return mapping[uiThickness] || "TWO_CM";
}

// Map database enum to UI format
function mapThicknessToUI(dbThickness: SlabThickness): string {
  const mapping: Record<SlabThickness, string> = {
    EIGHT_MM: "8mm",
    TWELVE_MM: "12mm",
    FIFTEEN_MM: "15mm",
    TWO_CM: "2cm",
    THREE_CM: "3cm",
  };
  return mapping[dbThickness] || "2cm";
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is ADMIN
    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { slabs } = body;

    if (!Array.isArray(slabs) || slabs.length === 0) {
      return NextResponse.json(
        { error: "Invalid request - slabs array required" },
        { status: 400 }
      );
    }

    const savedSlabs = [];

    for (const slab of slabs) {
      // Handle deletions
      if (slab._deleted) {
        if (!slab._isNew && slab.id && !slab.id.startsWith("new-")) {
          await prisma.slab.delete({
            where: { id: slab.id },
          });
        }
        continue; // Skip adding to savedSlabs
      }

      // Fetch brand config for finalPrice calculation
      const brandConfig = await prisma.slabBrandConfig.findUnique({
        where: { id: slab.brandId },
      });

      if (!brandConfig) {
        throw new Error(`Brand config not found for brandId: ${slab.brandId}`);
      }

      // Calculate final price
      const providerPriceDecimal = new Decimal(slab.listedPrice);
      const finalPriceDecimal = computeFinalPrice(
        providerPriceDecimal,
        brandConfig
      );

      let savedSlab;

      if (slab._isNew || !slab.id || slab.id.startsWith("new-")) {
        // Auto-assign slabNumber if null
        let slabNumber = slab.slabNumber;
        if (!slabNumber) {
          const maxSlab = await prisma.slab.findFirst({
            orderBy: { slabNumber: "desc" },
            select: { slabNumber: true },
          });
          slabNumber = (maxSlab?.slabNumber ?? 0) + 1;
        }

        // Create new slab
        savedSlab = await prisma.slab.create({
          data: {
            slabNumber: slabNumber,
            brandId: slab.brandId,
            series: slab.series,
            providerCode: slab.code,
            color: slab.color,
            finish: slab.finish,
            heightIn: new Decimal(slab.heightIn),
            widthIn: new Decimal(slab.widthIn),
            thickness: mapThicknessToEnum(slab.thickness),
            providerPrice: providerPriceDecimal,
            finalPrice: finalPriceDecimal,
            status: slab.status,
          },
          include: {
            brand: true,
          },
        });
      } else {
        // Update existing slab
        savedSlab = await prisma.slab.update({
          where: { id: slab.id },
          data: {
            slabNumber: slab.slabNumber,
            brandId: slab.brandId,
            series: slab.series,
            providerCode: slab.code,
            color: slab.color,
            finish: slab.finish,
            heightIn: new Decimal(slab.heightIn),
            widthIn: new Decimal(slab.widthIn),
            thickness: mapThicknessToEnum(slab.thickness),
            providerPrice: providerPriceDecimal,
            finalPrice: finalPriceDecimal,
            status: slab.status,
          },
          include: {
            brand: true,
          },
        });
      }

      // Transform back to UI format
      savedSlabs.push({
        id: savedSlab.id,
        slabNumber: savedSlab.slabNumber,
        brandId: savedSlab.brandId,
        brandName: savedSlab.brand.name,
        series: savedSlab.series,
        code: savedSlab.providerCode,
        color: savedSlab.color,
        finish: savedSlab.finish,
        heightIn: parseFloat(savedSlab.heightIn.toString()),
        widthIn: parseFloat(savedSlab.widthIn.toString()),
        thickness: mapThicknessToUI(savedSlab.thickness),
        listedPrice: parseFloat(savedSlab.providerPrice.toString()),
        finalPrice: parseFloat(savedSlab.finalPrice.toString()),
        status: savedSlab.status,
      });
    }

    return NextResponse.json({
      success: true,
      slabs: savedSlabs,
      message: `Successfully saved ${savedSlabs.length} slab(s)`,
    });
  } catch (error: any) {
    console.error("Error saving slabs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save slabs" },
      { status: 500 }
    );
  }
}

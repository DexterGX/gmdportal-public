import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/slabs/brands-overview
 * Fetch all brands with their color counts for the overview page
 */
export async function GET() {
  try {
    const brands = await prisma.slabBrandConfig.findMany({
      orderBy: { name: "asc" },
      include: {
        slabs: {
          where: {
            status: { not: "DISCONTINUED" },
          },
          select: { color: true },
        },
      },
    });

    // Count distinct colors for each brand
    const brandsWithCounts = brands.map((brand) => {
      const distinctColors = new Set(
        brand.slabs.map((s) => s.color.trim().toLowerCase())
      );

      return {
        id: brand.id,
        name: brand.name,
        logoUrl: brand.logoUrl,
        colorCount: distinctColors.size,
      };
    });

    return NextResponse.json({ brands: brandsWithCounts });
  } catch (error: any) {
    console.error("Failed to fetch brands overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch brands overview" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/slabs/availability
 * Fetch all available slabs with stock information
 */
export async function GET() {
  try {
    const slabs = await prisma.slab.findMany({
      where: {
        status: "AVAILABLE",
      },
      include: {
        brand: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ brand: { name: "asc" } }, { color: "asc" }],
    });

    // Transform data to match frontend expectations
    const availabilityData = slabs.map((slab) => ({
      id: slab.id,
      provider: slab.brand.name,
      colorName: slab.color,
      series: slab.series || undefined,
      finish: slab.finish.toLowerCase().replace(/_/g, " "),
      thickness: formatThickness(slab.thickness),
      size: `${Math.round(slab.heightIn * 25.4)}x${Math.round(
        slab.widthIn * 25.4
      )}mm`,
      isPromo: false, // TODO: Add promo field to schema if needed
      stockQty: 1, // TODO: Implement actual stock tracking
      location: "Warehouse A", // TODO: Implement location tracking
    }));

    return NextResponse.json({ slabs: availabilityData });
  } catch (error: any) {
    console.error("Failed to fetch availability:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability data" },
      { status: 500 }
    );
  }
}

function formatThickness(thickness: string): string {
  switch (thickness) {
    case "TWO_CM":
      return "20mm";
    case "THREE_CM":
      return "30mm";
    case "EIGHT_MM":
      return "8mm";
    case "TWELVE_MM":
      return "12mm";
    default:
      return "20mm";
  }
}

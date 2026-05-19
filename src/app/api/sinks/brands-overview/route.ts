import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const prismaAny = prisma as any;
    const brands = await prismaAny.sinkBrand.findMany({
      orderBy: { name: "asc" },
      include: {
        sinks: {
          where: { status: "AVAILABLE" },
          select: { id: true },
        },
      },
    });

    return NextResponse.json({
      brands: brands.map((brand: any) => ({
        id: brand.id,
        name: brand.name,
        logoUrl: brand.logoUrl,
        availableCount: Array.isArray(brand.sinks) ? brand.sinks.length : 0,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load sink brands" },
      { status: 500 },
    );
  }
}

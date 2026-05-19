import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const prismaAny = prisma as any;
    const sinks = await prismaAny.sink.findMany({
      where: {
        isPromotional: true,
        status: "AVAILABLE",
      },
      include: { brand: { select: { name: true } } },
      orderBy: [{ updatedAt: "desc" }],
    });

    return NextResponse.json({
      sinks: sinks.map((sink: any) => ({
        id: sink.id,
        brandName: sink.brand?.name || "",
        model: sink.model,
        description: sink.description,
        dimensions: sink.dimensions,
        listedPrice: Number(sink.listedPrice),
        promotionalPrice:
          sink.promotionalPrice !== null && sink.promotionalPrice !== undefined
            ? Number(sink.promotionalPrice)
            : null,
        finalPrice: Number(sink.finalPrice),
        imageUrl: sink.imageUrl,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load promotional sinks" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const prismaAny = prisma as any;
    const sinks = await prismaAny.sink.findMany({
      where: { status: "AVAILABLE" },
      include: { brand: { select: { name: true } } },
      orderBy: [{ brand: { name: "asc" } }, { model: "asc" }],
    });

    return NextResponse.json({
      sinks: sinks.map((sink: any) => ({
        id: sink.id,
        brandName: sink.brand?.name || "",
        model: sink.model,
        description: sink.description,
        dimensions: sink.dimensions,
        finalPrice: Number(sink.finalPrice),
        status: sink.status,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load sink availability" },
      { status: 500 },
    );
  }
}

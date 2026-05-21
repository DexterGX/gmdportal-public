import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const search = request.nextUrl.searchParams.get("search")?.trim() || "";
    const brandId = request.nextUrl.searchParams.get("brandId")?.trim() || "";
    const status = request.nextUrl.searchParams.get("status")?.trim() || "";
    const dimensions =
      request.nextUrl.searchParams.get("dimensions")?.trim() || "";

    const where: any = {};

    if (search) {
      where.OR = [
        { model: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (brandId) {
      where.brandId = brandId;
    }

    if (status === "AVAILABLE" || status === "DISCONTINUED") {
      where.status = status;
    }

    if (dimensions) {
      where.dimensions = { contains: dimensions, mode: "insensitive" };
    }

    const prismaAny = prisma as any;
    const sinks = await prismaAny.sink.findMany({
      where,
      include: { brand: { select: { id: true, name: true } } },
      orderBy: [{ updatedAt: "desc" }],
      take: 500,
    });

    const imageRows =
      sinks.length > 0
        ? await prismaAny.sinkModelImage.findMany({
            where: {
              OR: sinks.map((sink: any) => ({
                brandId: sink.brandId,
                model: sink.model,
              })),
            },
            select: { brandId: true, model: true, imageUrl: true },
          })
        : [];
    const imageByKey = new Map<string, string>();
    for (const row of imageRows) {
      imageByKey.set(`${row.brandId}:::${row.model}`, String(row.imageUrl));
    }

    return NextResponse.json({
      rows: sinks.map((sink: any) => ({
        id: sink.id,
        brandId: sink.brandId,
        brandName: sink.brand?.name || "",
        model: sink.model,
        description: sink.description,
        dimensions: sink.dimensions,
        listedPrice: Number(sink.listedPrice),
        finalPrice: Number(sink.finalPrice),
        status: sink.status,
        isPromotional: Boolean(sink.isPromotional),
        promotionalPrice:
          sink.promotionalPrice !== null && sink.promotionalPrice !== undefined
            ? Number(sink.promotionalPrice)
            : null,
        imageUrl: sink.imageUrl || imageByKey.get(`${sink.brandId}:::${sink.model}`) || null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load sinks" },
      { status: 500 },
    );
  }
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SinkBrandClient from "./SinkBrandClient";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

export default async function SinkBrandPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const { appRole } = await getCurrentUserWithRole();
  const brand = await prisma.sinkBrand.findUnique({
    where: { id: brandId },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      notes: {
        select: {
          id: true,
          title: true,
          content: true,
          catalogUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      sinks: {
        select: {
          id: true,
          series: true,
          model: true,
          description: true,
          dimensions: true,
          imageUrl: true,
          finalPrice: true,
        },
        where: { status: "AVAILABLE" },
        orderBy: [{ model: "asc" }, { dimensions: "asc" }],
      },
    },
  });

  if (!brand) {
    notFound();
  }

  const modelImages =
    brand.sinks.length > 0
      ? await (prisma as any).sinkModelImage.findMany({
          where: {
            brandId,
            model: { in: Array.from(new Set(brand.sinks.map((sink) => sink.model))) },
          },
          select: { model: true, imageUrl: true },
        })
      : [];
  const imageByModel = new Map<string, string>();
  for (const row of modelImages) {
    imageByModel.set(String(row.model), String(row.imageUrl));
  }

  const safeBrand = {
    id: brand.id,
    name: brand.name,
    logoUrl: brand.logoUrl,
    isAdmin: appRole === "admin",
    notes: brand.notes.map((note) => ({
      id: note.id,
      title: note.title,
      content: note.content,
      catalogUrl: note.catalogUrl,
      createdAt: note.createdAt.toISOString(),
    })),
    sinks: brand.sinks.map((sink) => ({
      id: sink.id,
      series: sink.series,
      model: sink.model,
      description: sink.description,
      dimensions: sink.dimensions,
      imageUrl: sink.imageUrl || imageByModel.get(sink.model) || null,
      finalPrice: Number(sink.finalPrice?.toString?.() ?? 0),
    })),
  };

  return <SinkBrandClient brand={safeBrand} />;
}

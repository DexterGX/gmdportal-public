import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SinkBrandClient from "./SinkBrandClient";

export default async function SinkBrandPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await prisma.sinkBrand.findUnique({
    where: { id: brandId },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      sinks: {
        select: {
          id: true,
          model: true,
          description: true,
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

  const safeBrand = {
    id: brand.id,
    name: brand.name,
    logoUrl: brand.logoUrl,
    sinks: brand.sinks.map((sink) => ({
      id: sink.id,
      model: sink.model,
      description: sink.description,
      imageUrl: sink.imageUrl,
      finalPrice: Number(sink.finalPrice?.toString?.() ?? 0),
    })),
  };

  return <SinkBrandClient brand={safeBrand} />;
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json([], { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json([]);
  }

  const slabs = await prisma.slab.findMany({
    where: {
      OR: [
        { color: { contains: query, mode: "insensitive" } },
        { series: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      color: true,
      series: true,
    },
    take: 10,
  });

  const names = Array.from(
    new Set(
      slabs
        .flatMap((slab) => [slab.color, slab.series])
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return NextResponse.json(names);
}

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

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { displayName: { contains: query, mode: "insensitive" } },
        { companyName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      displayName: true,
      companyName: true,
    },
    take: 10,
  });

  const names = Array.from(
    new Set(
      customers
        .flatMap((customer) => [customer.displayName, customer.companyName])
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return NextResponse.json(names);
}

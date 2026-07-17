import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getCustomerSuggestionSubtitle,
  type CustomerSuggestion,
} from "@/app/slab-rack-display/ui/customerSuggestions";

function normalizeOrgId(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^org_/, "");
}

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
      pipedriveId: { not: null },
      OR: [
        { displayName: { contains: query, mode: "insensitive" } },
        { companyName: { contains: query, mode: "insensitive" } },
        { pipedriveId: { contains: query, mode: "insensitive" } },
        { referredByOrgName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      displayName: true,
      companyName: true,
      referredByOrgName: true,
      referredByOrgPipedriveId: true,
      type: true,
      pipedriveId: true,
    },
    orderBy: [{ displayName: "asc" }],
    take: 12,
  });

  const orgIds = Array.from(
    new Set(
      customers
        .map((customer) => normalizeOrgId(customer.referredByOrgPipedriveId))
        .filter(Boolean) as string[],
    ),
  );

  const linkedOrgCustomers =
    orgIds.length > 0
      ? await prisma.customer.findMany({
          where: {
            OR: [
              { pipedriveId: { in: orgIds } },
              { pipedriveId: { in: orgIds.map((id) => `org_${id}`) } },
            ],
          },
          select: {
            pipedriveId: true,
            displayName: true,
            companyName: true,
          },
        })
      : [];

  const orgNameById = new Map<string, string>();
  for (const orgCustomer of linkedOrgCustomers) {
    const normalizedOrgId = normalizeOrgId(orgCustomer.pipedriveId);
    if (!normalizedOrgId) continue;
    orgNameById.set(
      normalizedOrgId,
      orgCustomer.companyName?.trim() || orgCustomer.displayName.trim(),
    );
  }

  const names: CustomerSuggestion[] = customers.map((customer) => {
    const resolvedOrgName =
      customer.referredByOrgName?.trim() ||
      orgNameById.get(
        normalizeOrgId(customer.referredByOrgPipedriveId) ?? "",
      ) ||
      null;

    return {
      id: customer.id,
      displayName: customer.displayName,
      companyName: customer.companyName,
      referredByOrgName: resolvedOrgName,
      type: customer.type,
      subtitle: getCustomerSuggestionSubtitle({
        id: customer.id,
        displayName: customer.displayName,
        companyName: customer.companyName,
        referredByOrgName: resolvedOrgName,
        type: customer.type,
      }),
    };
  });

  return NextResponse.json(names);
}

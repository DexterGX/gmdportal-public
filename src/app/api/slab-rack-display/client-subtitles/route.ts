import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCustomerSuggestionSubtitle } from "@/app/slab-rack-display/ui/customerSuggestions";

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function normalizeOrgId(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^org_/, "");
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ subtitles: {} }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    names?: unknown;
  } | null;
  const rawNames = Array.isArray(body?.names) ? body?.names : [];
  const names = Array.from(
    new Set(
      rawNames
        .map((name) => (typeof name === "string" ? name.trim() : ""))
        .filter(Boolean),
    ),
  );

  if (names.length === 0) {
    return NextResponse.json({ subtitles: {} });
  }

  const nameMatchers = names.map((name) => ({
    displayName: { equals: name, mode: "insensitive" as const },
  }));

  const customers = await prisma.customer.findMany({
    where: {
      pipedriveId: { not: null },
      OR: nameMatchers,
    },
    select: {
      id: true,
      displayName: true,
      companyName: true,
      referredByOrgName: true,
      referredByOrgPipedriveId: true,
      pipedriveId: true,
      type: true,
    },
    take: 200,
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

  const subtitles = new Map<string, string | null>();

  for (const customer of customers) {
    const key = normalizeName(customer.displayName);
    const resolvedOrgName =
      customer.referredByOrgName?.trim() ||
      orgNameById.get(
        normalizeOrgId(customer.referredByOrgPipedriveId) ?? "",
      ) ||
      null;

    const subtitle = getCustomerSuggestionSubtitle({
      id: customer.id,
      displayName: customer.displayName,
      companyName: customer.companyName,
      referredByOrgName: resolvedOrgName,
      type: customer.type,
    });

    if (!subtitles.has(key) || subtitle) {
      subtitles.set(key, subtitle);
    }
  }

  return NextResponse.json({
    subtitles: Object.fromEntries(subtitles),
  });
}

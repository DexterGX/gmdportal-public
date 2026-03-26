import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";

const prismaAny = prisma as any;

async function ensureBaseCostTiers() {
  const defaults = [
    { key: "A", name: "Cost A", sortOrder: 10 },
    { key: "B", name: "Cost B", sortOrder: 20 },
  ];

  for (const tier of defaults) {
    await prismaAny.cabinetInstallationCostTier.upsert({
      where: { key: tier.key },
      create: {
        key: tier.key,
        name: tier.name,
        sortOrder: tier.sortOrder,
        isActive: true,
      },
      update: {},
    });
  }
}

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { appRole } = await getCurrentUserWithRole();
  if (appRole !== "admin") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { error: null };
}

function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

async function findExistingItemByCode(codeRaw: string, excludeId?: string) {
  const code = codeRaw.trim();
  if (!code) return null;

  return prismaAny.cabinetInstallationItem.findFirst({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      code: {
        equals: code,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      code: true,
    },
  });
}

async function ensureCostTier(keyRaw: string) {
  const normalized = keyRaw.trim().toUpperCase();
  if (!normalized) return null;

  const existing = await prismaAny.cabinetInstallationCostTier.findUnique({
    where: { key: normalized },
  });
  if (existing) return existing;

  const total = await prismaAny.cabinetInstallationCostTier.count();
  return prismaAny.cabinetInstallationCostTier.create({
    data: {
      key: normalized,
      name: `Cost ${normalized}`,
      isActive: true,
      sortOrder: (total + 1) * 10,
    },
  });
}

async function upsertTierCosts(
  itemId: string,
  costsByTier: Record<string, unknown>,
) {
  const entries = Object.entries(costsByTier || {});
  const processedTierIds = new Set<string>();

  for (const [tierKey, rawValue] of entries) {
    const tier = await ensureCostTier(tierKey);
    if (!tier) continue;

    processedTierIds.add(tier.id);
    const parsedCost = parseMoney(rawValue);

    if (parsedCost === null) {
      await prismaAny.cabinetInstallationItemCost.deleteMany({
        where: { itemId, costTierId: tier.id },
      });
      continue;
    }

    await prismaAny.cabinetInstallationItemCost.upsert({
      where: {
        itemId_costTierId: {
          itemId,
          costTierId: tier.id,
        },
      },
      create: {
        itemId,
        costTierId: tier.id,
        cost: parsedCost,
      },
      update: {
        cost: parsedCost,
      },
    });
  }

  return processedTierIds;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;
    await ensureBaseCostTiers();

    const searchParams = request.nextUrl.searchParams;
    const search = (searchParams.get("search") || "").trim();
    const activeFilter = searchParams.get("active") || "all";
    const category = (searchParams.get("category") || "").trim();

    const where: any = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ];
    }

    if (activeFilter === "active") where.isActive = true;
    if (activeFilter === "inactive") where.isActive = false;
    if (category) where.category = category;

    const items = await prismaAny.cabinetInstallationItem.findMany({
      where,
      include: {
        costs: {
          include: {
            costTier: { select: { id: true, key: true, name: true } },
          },
          orderBy: {
            costTier: { sortOrder: "asc" },
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { description: "asc" }],
    });

    const costTiers = await prismaAny.cabinetInstallationCostTier.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });

    return NextResponse.json({ items, costTiers });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch cabinet installation items" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const {
      code,
      description,
      category,
      defaultWillingToPay,
      salePrice,
      isActive,
      costsByTier,
    }: {
      code?: string | null;
      description?: string;
      category?: string | null;
      defaultWillingToPay?: number | string;
      salePrice?: number | string;
      isActive?: boolean;
      costsByTier?: Record<string, unknown>;
    } = body;

    if (!description?.trim()) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 },
      );
    }

    const willingToPay = parseMoney(defaultWillingToPay);
    if (willingToPay === null) {
      return NextResponse.json(
        { error: "Default willing to pay must be a valid non-negative number" },
        { status: 400 },
      );
    }

    const parsedSalePrice = parseMoney(salePrice);
    if (parsedSalePrice === null) {
      return NextResponse.json(
        { error: "Sale price must be a valid non-negative number" },
        { status: 400 },
      );
    }

    if (code?.trim()) {
      const existing = await findExistingItemByCode(code);
      if (existing) {
        return NextResponse.json(
          { error: `Code ${code.trim()} already exists` },
          { status: 400 },
        );
      }
    }

    const created = await prismaAny.cabinetInstallationItem.create({
      data: {
        code: code?.trim() ? code.trim() : null,
        description: description.trim(),
        category: category?.trim() ? category.trim() : null,
        defaultWillingToPay: willingToPay,
        salePrice: parsedSalePrice,
        isActive: isActive ?? true,
      },
    });

    if (costsByTier && typeof costsByTier === "object") {
      await upsertTierCosts(created.id, costsByTier);
    }

    const item = await prismaAny.cabinetInstallationItem.findUnique({
      where: { id: created.id },
      include: {
        costs: {
          include: {
            costTier: { select: { id: true, key: true, name: true } },
          },
          orderBy: {
            costTier: { sortOrder: "asc" },
          },
        },
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create cabinet installation item" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const {
      id,
      code,
      description,
      category,
      defaultWillingToPay,
      salePrice,
      isActive,
      costsByTier,
    }: {
      id?: string;
      code?: string | null;
      description?: string;
      category?: string | null;
      defaultWillingToPay?: number | string;
      salePrice?: number | string;
      isActive?: boolean;
      costsByTier?: Record<string, unknown>;
    } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (!description?.trim()) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 },
      );
    }

    const willingToPay = parseMoney(defaultWillingToPay);
    if (willingToPay === null) {
      return NextResponse.json(
        { error: "Default willing to pay must be a valid non-negative number" },
        { status: 400 },
      );
    }

    const parsedSalePrice = parseMoney(salePrice);
    if (parsedSalePrice === null) {
      return NextResponse.json(
        { error: "Sale price must be a valid non-negative number" },
        { status: 400 },
      );
    }

    if (code?.trim()) {
      const existing = await findExistingItemByCode(code, id);
      if (existing) {
        return NextResponse.json(
          { error: `Code ${code.trim()} already exists` },
          { status: 400 },
        );
      }
    }

    await prismaAny.cabinetInstallationItem.update({
      where: { id },
      data: {
        code: code?.trim() ? code.trim() : null,
        description: description.trim(),
        category: category?.trim() ? category.trim() : null,
        defaultWillingToPay: willingToPay,
        salePrice: parsedSalePrice,
        isActive: isActive ?? true,
      },
    });

    if (costsByTier && typeof costsByTier === "object") {
      await upsertTierCosts(id, costsByTier);
    }

    const item = await prismaAny.cabinetInstallationItem.findUnique({
      where: { id },
      include: {
        costs: {
          include: {
            costTier: { select: { id: true, key: true, name: true } },
          },
          orderBy: {
            costTier: { sortOrder: "asc" },
          },
        },
      },
    });

    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update cabinet installation item" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const id = body?.id as string | undefined;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prismaAny.cabinetInstallationItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete cabinet installation item" },
      { status: 500 },
    );
  }
}

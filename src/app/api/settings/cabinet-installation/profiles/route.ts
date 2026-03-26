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

export async function GET(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;
    await ensureBaseCostTiers();

    const searchParams = request.nextUrl.searchParams;
    const search = (searchParams.get("search") || "").trim();
    const active = searchParams.get("active") || "all";

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    if (active === "active") where.isActive = true;
    if (active === "inactive") where.isActive = false;

    const profiles = await prismaAny.cabinetInstallerProfile.findMany({
      where,
      include: {
        costTier: {
          select: { id: true, key: true, name: true },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    const costTiers = await prismaAny.cabinetInstallationCostTier.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });

    return NextResponse.json({ profiles, costTiers });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch installer profiles" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;
    await ensureBaseCostTiers();

    const body = await request.json();
    const {
      name,
      code,
      notes,
      costTierKey,
      isActive,
    }: {
      name?: string;
      code?: string | null;
      notes?: string | null;
      costTierKey?: string | null;
      isActive?: boolean;
    } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Installer profile name is required" },
        { status: 400 },
      );
    }

    const selectedTier = await prismaAny.cabinetInstallationCostTier.findFirst({
      where: {
        key: (costTierKey || "A").trim().toUpperCase(),
        isActive: true,
      },
      select: { id: true },
    });

    const created = await prismaAny.cabinetInstallerProfile.create({
      data: {
        name: name.trim(),
        code: code?.trim() ? code.trim() : null,
        notes: notes?.trim() ? notes.trim() : null,
        costTierId: selectedTier?.id || null,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "A profile with this name or code already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error?.message || "Failed to create installer profile" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;
    await ensureBaseCostTiers();

    const body = await request.json();
    const {
      id,
      name,
      code,
      notes,
      costTierKey,
      isActive,
    }: {
      id?: string;
      name?: string;
      code?: string | null;
      notes?: string | null;
      costTierKey?: string | null;
      isActive?: boolean;
    } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Installer profile name is required" },
        { status: 400 },
      );
    }

    const selectedTier = await prismaAny.cabinetInstallationCostTier.findFirst({
      where: {
        key: (costTierKey || "A").trim().toUpperCase(),
        isActive: true,
      },
      select: { id: true },
    });

    const updated = await prismaAny.cabinetInstallerProfile.update({
      where: { id },
      data: {
        name: name.trim(),
        code: code?.trim() ? code.trim() : null,
        notes: notes?.trim() ? notes.trim() : null,
        costTierId: selectedTier?.id || null,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "A profile with this name or code already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error?.message || "Failed to update installer profile" },
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

    await prismaAny.cabinetInstallerProfile.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete installer profile" },
      { status: 500 },
    );
  }
}

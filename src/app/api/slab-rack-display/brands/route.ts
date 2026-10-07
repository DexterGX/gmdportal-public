import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

// Seed list: these are the brands SlabBay originally shipped with as a
// hardcoded dropdown. They're inserted once, the first time this table is
// read, so nobody loses an existing option when brands moved from a
// hardcoded array to the database-backed list managed on the Brand Settings
// admin page.
const DEFAULT_BRAND_NAMES = [
  "CAMBRIA",
  "CEASARSTONE - Porcelain",
  "CEASARSTONE - Quartz",
  "COMPAC",
  "COSENTINO - Dekton Porcelain",
  "COSENTINO - Silestone Quartz",
  "COVERLAM(HRA) - Porcelain",
  "DALTILE - Panoramic Porcelain",
  "DALTILE - Quartz",
  "KIVA",
  "LX HAUSYS",
  "MSI - Quartz",
  "NEOLITH",
  "OPUSTONE - Relativa Porcelain",
  "OPUSTONE - Santamargherita Quartz",
  "PENTAL - Quartz",
  "SPECTRUM - Quartz",
  "STONE MALL",
  "TSFC",
  "UMI - Infinity Porcelain",
  "UMI - Pompeii Quartz",
  "UMI - Vetrazzo",
  "WILLSONART",
];

let seedPromise: Promise<void> | null = null;

const ensureSeeded = async () => {
  if (!seedPromise) {
    seedPromise = (async () => {
      const count = await prisma.slabBayBrand.count();
      if (count > 0) return;
      await prisma.slabBayBrand.createMany({
        data: DEFAULT_BRAND_NAMES.map((name) => ({ name })),
        skipDuplicates: true,
      });
    })().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  await seedPromise;
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json([], { status: 401 });
  }

  await ensureSeeded();

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("all") === "1";

  const brands = await prisma.slabBayBrand.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      isActive: brand.isActive,
    })),
  );
}

// Any authenticated SlabBay user can register a new brand name - this is
// what lets someone who typed a custom name into "Other" have it show up as
// a first-class option the next time anyone adds a slab, instead of having
// to pick "Other" and retype it every time.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSeeded();

  const body = (await request.json().catch(() => null)) as {
    name?: string;
  } | null;
  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Brand name is required." }, {
      status: 400,
    });
  }

  const existing = await prisma.slabBayBrand.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({
      id: existing.id,
      name: existing.name,
      isActive: existing.isActive,
    });
  }

  const created = await prisma.slabBayBrand.create({
    data: { name },
  });

  return NextResponse.json(
    { id: created.id, name: created.name, isActive: created.isActive },
    { status: 201 },
  );
}

// Archive / restore (soft delete). Admin only, matching the rest of
// SlabBay's admin-gated settings (Rack Settings).
export async function PATCH(request: Request) {
  const { appRole } = await getProgramUserContext("slabRack");
  if (appRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    isActive?: boolean;
    name?: string;
  } | null;
  if (!body?.id) {
    return NextResponse.json({ error: "Brand id is required." }, {
      status: 400,
    });
  }

  const data: { isActive?: boolean; name?: string } = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }

  const updated = await prisma.slabBayBrand.update({
    where: { id: body.id },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    isActive: updated.isActive,
  });
}

// Permanent delete. Admin only. Safe to remove outright: SlabBaySlab.brand
// is a free-text column (not a foreign key), so existing/historical slabs
// keep whatever brand text they already have - deleting an entry here only
// removes it from the picker offered for new slabs.
export async function DELETE(request: Request) {
  const { appRole } = await getProgramUserContext("slabRack");
  if (appRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Brand id is required." }, {
      status: 400,
    });
  }

  await prisma.slabBayBrand.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

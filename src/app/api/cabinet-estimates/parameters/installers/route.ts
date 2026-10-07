import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireAdmin() {
  const { user, appRole, isActive, appRoles } = await getProgramUserContext("cabinetEstimates");
  if (!user || !isActive || appRoles.length === 0) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (appRole !== "admin") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, user };
}

// Round 11 - individual installers, each with their own per-item cost in
// the Installers Price Table (CabinetInstallerServiceCost). Admin-only -
// this internal cost bookkeeping is never read by the estimate form.
//
// Round 11 follow-up: Diego was already tracking Company/Address/Phone/
// Email per installer in a separate "GMD Cabinet Installers Payment"
// spreadsheet - self-heals the 5 real installers from that sheet in here
// the first time this route is hit with zero rows, same seed-on-read
// pattern this project uses elsewhere (installation types, vendors), so
// he doesn't have to retype real business contact info he already had.
const SEED_INSTALLERS = [
  {
    name: "Bruno",
    company: "JB Wood Finish",
    address: "7924 Nolting Ct, Lake Worth, FL 33467",
    phone: "561-909-8174",
    email: "jbwoodfinish5@gmail.com",
  },
  {
    name: "Cristian Leon",
    company: "Aron Services VC",
    address: "Acc. #: 689667676",
    phone: "561-897-6575",
    email: "leon65.4@hotmail.com",
  },
  {
    name: "Eliezer",
    company: "CIA Amazon River USA",
    address: "123 backroad, Boca Raton, FL 33445",
    phone: "561-403-9300",
    email: "amazonriver.usa@gmail.com",
  },
  {
    name: "Lucas",
    company: "Gulfstream Home Design",
    address: "",
    phone: "617-461-7385",
    email: "lucasthabet@gmail.com",
  },
  {
    name: "Ze",
    company: "Seattle General Services",
    address: "15323 68th Ct North, Loxahatchee, FL 33470",
    phone: "561-929-3593",
    email: "seattlegs@hotmail.com",
  },
];

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const existingCount = await prismaAny.cabinetInstaller.count();
  if (existingCount === 0) {
    await prismaAny.cabinetInstaller.createMany({
      data: SEED_INSTALLERS.map((installer, index) => ({
        ...installer,
        sortOrder: index,
      })),
      skipDuplicates: true,
    });
  }

  const installers = await prismaAny.cabinetInstaller.findMany({
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ installers });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const maxSortOrder = await prismaAny.cabinetInstaller.aggregate({
      _max: { sortOrder: true },
    });
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

    const installer = await prismaAny.cabinetInstaller.create({
      data: {
        name,
        company: body.company === undefined ? null : String(body.company || "").trim() || null,
        address: body.address === undefined ? null : String(body.address || "").trim() || null,
        phone: body.phone === undefined ? null : String(body.phone || "").trim() || null,
        email: body.email === undefined ? null : String(body.email || "").trim() || null,
        isActive: body.isActive === undefined ? true : Boolean(body.isActive),
        sortOrder: Number.isFinite(toNumber(body.sortOrder))
          ? Math.trunc(toNumber(body.sortOrder))
          : nextSortOrder,
      },
    });

    return NextResponse.json(installer, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create installer", error);
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "An installer with that name already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error?.message || "Failed to create installer" },
      { status: 500 },
    );
  }
}

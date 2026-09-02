import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const prismaAny = prisma as any;

// Any role that can create/edit estimates can read the active catalog (they
// need it to fill out the Special Customization section); only admins can
// manage the catalog itself.
const VIEW_ROLES = ["admin", "sales", "office", "finance"];

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireViewer() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (!VIEW_ROLES.includes(appRole)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, user, appRole };
}

export async function GET(request: NextRequest) {
  const auth = await requireViewer();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") || "active"; // active | all

  const where: any = {};
  if (status === "active") where.isActive = true;

  const items = await prismaAny.cabinetSpecialCustomizationItem.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(
    items.map((item: any) => ({
      ...item,
      price: toNumber(item.price),
    })),
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireViewer();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (auth.appRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const maxSortOrder = await prismaAny.cabinetSpecialCustomizationItem.aggregate({
      _max: { sortOrder: true },
    });
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

    const item = await prismaAny.cabinetSpecialCustomizationItem.create({
      data: {
        name,
        price: Math.max(0, toNumber(body.price)),
        isActive: body.isActive === undefined ? true : Boolean(body.isActive),
        sortOrder: Number.isFinite(toNumber(body.sortOrder))
          ? Math.trunc(toNumber(body.sortOrder))
          : nextSortOrder,
      },
    });

    return NextResponse.json(
      { ...item, price: toNumber(item.price) },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("Failed to create special customization item", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create item" },
      { status: 500 },
    );
  }
}

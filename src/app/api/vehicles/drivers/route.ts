import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const prismaAny = prisma as any;

const VIEW_ROLES = [
  "admin",
  "sales",
  "office",
  "finance",
  "specialist",
  "installer",
];

type DriverBody = {
  id?: string;
  name?: string;
  sortOrder?: number;
  active?: boolean;
  action?: "save" | "activate" | "deactivate" | "delete";
};

async function requireViewer() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (!VIEW_ROLES.includes(appRole)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, user };
}

async function requireAdmin() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole === "unassigned") {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  if (appRole !== "admin") {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, user };
}

export async function GET(request: NextRequest) {
  const auth = await requireViewer();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const status = request.nextUrl.searchParams.get("status") || "active";
  const where: any = {};
  if (status === "active") where.active = true;
  if (status === "inactive") where.active = false;

  const drivers = await prismaAny.vehicleDriver.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(drivers);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as DriverBody;
    const id = body.id?.trim();
    const action = body.action || "save";

    if (action === "activate" || action === "deactivate") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }
      const updated = await prismaAny.vehicleDriver.update({
        where: { id },
        data: { active: action === "activate" },
      });
      return NextResponse.json(updated);
    }

    if (action === "delete") {
      if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
      }
      try {
        await prismaAny.vehicleDriver.delete({ where: { id } });
      } catch (err: any) {
        if (err?.code === "P2003" || err?.code === "P2014") {
          return NextResponse.json(
            {
              error:
                "This driver is referenced by a vehicle or inspection and can't be permanently deleted. Deactivate it instead.",
            },
            { status: 409 },
          );
        }
        throw err;
      }
      return NextResponse.json({ success: true });
    }

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0;
    const active = body.active !== false;

    if (id) {
      const updated = await prismaAny.vehicleDriver.update({
        where: { id },
        data: { name, sortOrder, active },
      });
      return NextResponse.json(updated);
    }

    const created = await prismaAny.vehicleDriver.create({
      data: { name, sortOrder, active },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    const message =
      error?.code === "P2002"
        ? "That driver name already exists."
        : error?.message || "Failed to save driver";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

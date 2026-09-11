import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";

const prismaAny = prisma as any;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const existing = await prismaAny.cabinetInstaller.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data: any = {};
    if (body.name !== undefined) {
      const name = String(body.name || "").trim();
      if (!name) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      data.name = name;
    }
    if (body.company !== undefined) {
      data.company = String(body.company || "").trim() || null;
    }
    if (body.address !== undefined) {
      data.address = String(body.address || "").trim() || null;
    }
    if (body.phone !== undefined) {
      data.phone = String(body.phone || "").trim() || null;
    }
    if (body.email !== undefined) {
      data.email = String(body.email || "").trim() || null;
    }
    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }
    if (body.sortOrder !== undefined) {
      data.sortOrder = Math.trunc(toNumber(body.sortOrder));
    }

    const installer = await prismaAny.cabinetInstaller.update({ where: { id }, data });
    return NextResponse.json(installer);
  } catch (error: any) {
    console.error("Failed to update installer", error);
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "An installer with that name already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error?.message || "Failed to update installer" },
      { status: 500 },
    );
  }
}

// Installers are never referenced by a saved estimate (their cost figures
// are internal bookkeeping only, per Diego - never read by any estimate
// calc), so unlike CabinetInstallationServiceItem/CabinetInstallationType
// there's no "used on a saved estimate" case to guard against. Deleting an
// installer just cascades away their CabinetInstallerServiceCost rows.
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const existing = await prismaAny.cabinetInstaller.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prismaAny.cabinetInstaller.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

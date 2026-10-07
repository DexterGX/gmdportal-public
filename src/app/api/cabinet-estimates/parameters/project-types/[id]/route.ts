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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const existing = await prismaAny.cabinetProjectType.findUnique({ where: { id } });
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
    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }
    if (body.sortOrder !== undefined) {
      data.sortOrder = Math.trunc(toNumber(body.sortOrder));
    }

    const type = await prismaAny.cabinetProjectType.update({ where: { id }, data });
    return NextResponse.json(type);
  } catch (error: any) {
    console.error("Failed to update project type", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update project type" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const existing = await prismaAny.cabinetProjectType.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Unlike Removal/Installation Type, Project Type has no FK on
  // CabinetEstimate (projectType stays a plain denormalized string, same
  // as before this feature) - deleting an option here can never corrupt
  // a saved estimate's data, so this hard-deletes with no usage guard,
  // same as CabinetInstaller.
  await prismaAny.cabinetProjectType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

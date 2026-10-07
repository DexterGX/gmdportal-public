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

// Round 11 - the Installers Price Table's cost matrix (installer x item).
// Purely internal bookkeeping (per Diego) - never read by any estimate
// calc, admin-only both ways.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const costs = await prismaAny.cabinetInstallerServiceCost.findMany();
  return NextResponse.json({
    costs: costs.map((c: any) => ({
      installerId: c.installerId,
      itemId: c.itemId,
      cost: toNumber(c.cost),
    })),
  });
}

type CostPatchBody = {
  costs?: { installerId?: string; itemId?: string; cost?: number | string }[];
};

// Bulk upsert-by-key, same shape as the old labor-rates route this
// replaces: pass every cell that changed, each keyed by
// {installerId, itemId} (unique together).
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as CostPatchBody;
    const rows = Array.isArray(body.costs) ? body.costs : [];

    for (const row of rows) {
      if (!row.installerId || !row.itemId) continue;
      await prismaAny.cabinetInstallerServiceCost.upsert({
        where: {
          installerId_itemId: { installerId: row.installerId, itemId: row.itemId },
        },
        create: {
          installerId: row.installerId,
          itemId: row.itemId,
          cost: toNumber(row.cost),
        },
        update: { cost: toNumber(row.cost) },
      });
    }

    const updated = await prismaAny.cabinetInstallerServiceCost.findMany();
    return NextResponse.json({
      costs: updated.map((c: any) => ({
        installerId: c.installerId,
        itemId: c.itemId,
        cost: toNumber(c.cost),
      })),
    });
  } catch (error: any) {
    console.error("Failed to save installer costs", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save installer costs" },
      { status: 500 },
    );
  }
}

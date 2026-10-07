import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import { canViewCabinetCost } from "@/lib/cabinetCostView";

const prismaAny = prisma as any;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Data behind the "Preco de Custo" view: active installers, their cost per
// Installers Price Table item, and the tax %. Admins / finance only.
export async function GET() {
  const ctx = await getProgramUserContext("cabinetEstimates");
  if (!ctx.user || !ctx.isActive || ctx.appRoles.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ctx.canAccess || !canViewCabinetCost(ctx)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [installers, costs, settings] = await Promise.all([
    prismaAny.cabinetInstaller.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true },
    }),
    prismaAny.cabinetInstallerServiceCost.findMany(),
    prismaAny.cabinetEstimateParameters.findFirst(),
  ]);

  return NextResponse.json({
    installers,
    costs: costs.map((c: any) => ({
      installerId: c.installerId,
      itemId: c.itemId,
      cost: toNumber(c.cost),
    })),
    taxPercent: toNumber(settings?.costTaxPercent),
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

/**
 * GET /api/cabinet-catalog/vendors/[id]/tiers
 * Active price tiers for one vendor, for the estimate form's Group/Color
 * selector (scoped to the chosen Brand/vendor).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { isActive } = await getProgramUserContext("cabinetEstimates");
    if (!isActive) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const tiers = await prismaAny.cabinetPriceTier.findMany({
      where: { vendorId: id, isActive: true },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ tiers });
  } catch (error: any) {
    console.error("Error fetching cabinet price tiers:", error);
    return NextResponse.json({ error: "Failed to fetch price tiers" }, { status: 500 });
  }
}

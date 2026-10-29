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
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { isActive } = await getProgramUserContext("cabinetEstimates");
    if (!isActive) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    // An estimate saved with a color that has since been switched off still
    // needs that color in its dropdown - the form passes its tier id here.
    const includeTierId = new URL(request.url).searchParams.get("includeTierId");
    const tiers = await prismaAny.cabinetPriceTier.findMany({
      where: {
        vendorId: id,
        OR: [{ isActive: true }, ...(includeTierId ? [{ id: includeTierId }] : [])],
      },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    // Vendors whose many colors are priced in Levels also list the colors:
    // each one points at its Level (a tier above).
    const colors = await prismaAny.cabinetColorOption.findMany({
      where: { vendorId: id, isActive: true },
      select: { id: true, label: true, tierId: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });

    return NextResponse.json({ tiers, colors });
  } catch (error: any) {
    console.error("Error fetching cabinet price tiers:", error);
    return NextResponse.json({ error: "Failed to fetch price tiers" }, { status: 500 });
  }
}

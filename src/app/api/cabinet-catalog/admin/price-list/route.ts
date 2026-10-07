import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

/**
 * GET /api/cabinet-catalog/admin/price-list?vendorId=&includeInactive=0|1
 *
 * Admin-only, read-only browse for the new "Price List" page (round 8):
 * every catalog item for one vendor, with its price at every one of that
 * vendor's price tiers side by side, plus when this vendor's catalog was
 * last touched by an import. Nothing here is editable - actual price
 * changes still go through Import Price List, same as before.
 *
 * "Last updated" is derived, not stored: CabinetCatalogItem.updatedAt is
 * bumped by Prisma's @updatedAt on every create *and* on every apply-time
 * update (the import Apply route unconditionally calls
 * cabinetCatalogItem.update for every changed item, and updateMany when
 * marking items discontinued), so MAX(updatedAt) across a vendor's items
 * is a reliable proxy for "the last time this vendor's price list changed"
 * without needing a new column.
 */
export async function GET(request: Request) {
  try {
    const { appRole } = await getProgramUserContext("cabinetEstimates");
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get("vendorId");
    const includeInactive = searchParams.get("includeInactive") === "1";

    if (!vendorId) {
      return NextResponse.json({ error: "vendorId is required" }, { status: 400 });
    }

    const vendor = await prismaAny.cabinetVendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        name: true,
        provider: { select: { displayName: true, discount: true, factor: true } },
      },
    });
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const tiers = await prismaAny.cabinetPriceTier.findMany({
      where: { vendorId, isActive: true },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const items = await prismaAny.cabinetCatalogItem.findMany({
      where: { vendorId, ...(includeInactive ? {} : { isActive: true }) },
      select: {
        id: true,
        code: true,
        description: true,
        category: true,
        summaryBucket: true,
        isActive: true,
        updatedAt: true,
        prices: { select: { tierId: true, price: true } },
      },
      orderBy: [{ code: "asc" }],
    });

    let lastUpdated: string | null = null;
    for (const item of items) {
      const iso = item.updatedAt.toISOString();
      if (!lastUpdated || iso > lastUpdated) lastUpdated = iso;
    }

    return NextResponse.json({
      vendor: {
        id: vendor.id,
        name: vendor.name,
        displayName: vendor.provider ? vendor.provider.displayName : vendor.name,
        discount: vendor.provider ? Number(vendor.provider.discount) : null,
        factor: vendor.provider ? Number(vendor.provider.factor) : null,
      },
      tiers,
      lastUpdated,
      items: items.map((item: any) => ({
        id: item.id,
        code: item.code,
        description: item.description,
        category: item.category,
        summaryBucket: item.summaryBucket,
        isActive: item.isActive,
        updatedAt: item.updatedAt.toISOString(),
        prices: Object.fromEntries(
          item.prices.map((p: any) => [p.tierId, Number(p.price)]),
        ),
      })),
    });
  } catch (error: any) {
    console.error("Error fetching cabinet price list:", error);
    return NextResponse.json({ error: "Failed to fetch price list" }, { status: 500 });
  }
}

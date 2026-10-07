import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import { computeCabinetSellPrice } from "@/lib/cabinetCatalogPricing";

const prismaAny = prisma as any;

/**
 * GET /api/cabinet-catalog/items?vendorId=&tierId=&q=
 * GET /api/cabinet-catalog/items?vendorId=&tierId=&ids=id1,id2,...
 *
 * Item-code autocomplete for the estimate form's item table: matches on
 * code or description, scoped to a vendor, and (when tierId is given)
 * includes that tier's price so the caller can autofill P.Unit directly.
 *
 * `ids` is a separate lookup mode (used by the estimate form's live
 * re-pricing when Brand/Group-Color changes): given a specific set of
 * catalog item ids, returns exactly those items' current description and
 * (for the given tierId) price. This is a plain `id IN (...)` match, not a
 * text search, so it's exact - unlike `q`, it can't accidentally miss or
 * over-match an item because its code happens to be a substring of others.
 * `q` and `ids` are mutually exclusive; `ids` takes precedence if both are
 * somehow present.
 *
 * Round 6: the stored CabinetCatalogItemPrice is net cost only - here we
 * multiply by the vendor's linked company "factor" (sales multiplier,
 * defaults to 1) to get the sell price actually shown/used on the estimate.
 * This is a live computation, not baked into storage, so changing a
 * company's factor takes effect immediately for every future selection.
 */
export async function GET(request: Request) {
  try {
    const { isActive } = await getProgramUserContext("cabinetEstimates");
    if (!isActive) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get("vendorId");
    const tierId = searchParams.get("tierId");
    const q = (searchParams.get("q") || "").trim();
    const idsParam = (searchParams.get("ids") || "").trim();
    const ids = idsParam
      ? idsParam
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    if (!vendorId) {
      return NextResponse.json({ error: "vendorId is required" }, { status: 400 });
    }

    let factor = 1;
    if (tierId) {
      const vendor = await prismaAny.cabinetVendor.findUnique({
        where: { id: vendorId },
        select: { provider: { select: { factor: true } } },
      });
      if (vendor?.provider?.factor !== undefined && vendor?.provider?.factor !== null) {
        factor = Number(vendor.provider.factor);
      }
    }

    const items = await prismaAny.cabinetCatalogItem.findMany({
      where: {
        vendorId,
        isActive: true,
        ...(ids.length > 0
          ? { id: { in: ids } }
          : q
            ? {
                OR: [
                  { code: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
      },
      select: {
        id: true,
        code: true,
        description: true,
        category: true,
        summaryBucket: true,
        installationItemId: true,
        catalogImageUrl: true,
        prices: tierId ? { where: { tierId }, select: { price: true } } : false,
      },
      orderBy: { code: "asc" },
      take: ids.length > 0 ? ids.length : 20,
    });

    return NextResponse.json({
      items: items.map((item: any) => ({
        id: item.id,
        code: item.code,
        description: item.description,
        category: item.category,
        summaryBucket: item.summaryBucket,
        installationItemId: item.installationItemId,
        catalogImageUrl: item.catalogImageUrl || null,
        unitPrice:
          tierId && Array.isArray(item.prices) && item.prices.length > 0
            ? computeCabinetSellPrice(Number(item.prices[0].price), factor)
            : null,
      })),
    });
  } catch (error: any) {
    console.error("Error searching cabinet catalog items:", error);
    return NextResponse.json({ error: "Failed to search items" }, { status: 500 });
  }
}

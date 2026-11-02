import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import { computeCabinetSellPrice } from "@/lib/cabinetCatalogPricing";
import {
  cabinetCodeSearchVariants,
  matchCodesToCatalog,
  normalizeCabinetCode,
} from "@/lib/cabinetCodeMatch";

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
 * `codes` is a third lookup mode (used when the estimate's Brand changes):
 * given the item codes already on the estimate, returns this vendor's item
 * for each one, matching leniently so B9 finds B09 (and W30-30 finds W3030).
 * Each result carries `requestedCode` so the caller knows which row it
 * belongs to; codes with no match are simply absent.
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
    const codesParam = searchParams.get("codes") || "";
    const codes = codesParam
      ? Array.from(
          new Set(
            codesParam
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean),
          ),
        )
      : [];
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

    const itemSelect = {
      id: true,
      code: true,
      description: true,
      category: true,
      summaryBucket: true,
      installationItemId: true,
      catalogImageUrl: true,
      prices: tierId ? { where: { tierId }, select: { price: true } } : false,
    };

    const mapItem = (item: any, requestedCode?: string) => ({
      id: item.id,
      code: item.code,
      ...(requestedCode !== undefined ? { requestedCode } : {}),
      description: item.description,
      category: item.category,
      summaryBucket: item.summaryBucket,
      installationItemId: item.installationItemId,
      catalogImageUrl: item.catalogImageUrl || null,
      unitPrice:
        tierId && Array.isArray(item.prices) && item.prices.length > 0
          ? computeCabinetSellPrice(Number(item.prices[0].price), factor)
          : null,
    });

    if (ids.length === 0 && codes.length > 0) {
      // Codes only (cheap) for the whole vendor, matched in memory, then the
      // full rows for just the matches.
      const allCodes: { id: string; code: string }[] =
        await prismaAny.cabinetCatalogItem.findMany({
          where: { vendorId, isActive: true },
          select: { id: true, code: true },
          orderBy: { code: "asc" },
        });
      const matched = matchCodesToCatalog(codes, allCodes);
      const matchedIds = Array.from(
        new Set(Array.from(matched.values()).map((m) => m.id)),
      );
      const rows: any[] =
        matchedIds.length > 0
          ? await prismaAny.cabinetCatalogItem.findMany({
              where: { id: { in: matchedIds } },
              select: itemSelect,
            })
          : [];
      const rowById = new Map<string, any>(rows.map((r) => [r.id, r]));
      const out: ReturnType<typeof mapItem>[] = [];
      matched.forEach((hit, wanted) => {
        const row = rowById.get(hit.id);
        if (row) out.push(mapItem(row, wanted));
      });
      return NextResponse.json({ items: out });
    }

    // Typing "B9" should also offer "B09" (and the other way round).
    const qVariants = q ? cabinetCodeSearchVariants(q) : [];

    const items = await prismaAny.cabinetCatalogItem.findMany({
      where: {
        vendorId,
        isActive: true,
        ...(ids.length > 0
          ? { id: { in: ids } }
          : q
            ? {
                OR: [
                  ...qVariants.map((variant) => ({
                    code: { contains: variant, mode: "insensitive" },
                  })),
                  { description: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
      },
      select: itemSelect,
      orderBy: { code: "asc" },
      take: ids.length > 0 ? ids.length : q ? 80 : 20,
    });

    if (q && ids.length === 0) {
      // Best matches first: codes that start with what was typed (ignoring
      // leading zeros), then the rest, then everything else A-Z.
      const wanted = normalizeCabinetCode(q);
      const rank = (code: string) => {
        const n = normalizeCabinetCode(code);
        if (n === wanted) return 0;
        if (n.startsWith(wanted)) return 1;
        if (n.includes(wanted)) return 2;
        return 3;
      };
      items.sort(
        (a: any, b: any) =>
          rank(a.code) - rank(b.code) || String(a.code).localeCompare(b.code),
      );
      items.length = Math.min(items.length, 20);
    }

    return NextResponse.json({ items: items.map((item: any) => mapItem(item)) });
  } catch (error: any) {
    console.error("Error searching cabinet catalog items:", error);
    return NextResponse.json({ error: "Failed to search items" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import type { NormalizedImportItem, CabinetSummaryBucket } from "@/lib/cabinetCatalogImport";

const prismaAny = prisma as any;

async function requireAdmin() {
  const { user, appRole, isActive } = await getProgramUserContext("cabinetEstimates");
  if (!user || !isActive || appRole !== "admin") return null;
  return { user, appRole };
}

type ApplyPayload = {
  vendorId: string | null;
  newVendorName: string | null;
  newItems: NormalizedImportItem[];
  changedItems: { existingId: string; incoming: NormalizedImportItem }[];
  discontinuedIds: string[];
};

/**
 * POST /api/cabinet-catalog/admin/import/apply
 *
 * Commits a reviewed import (see .../import/preview) to the real catalog:
 * creates the vendor if new, upserts any price tiers referenced, then
 * creates/updates/discontinues catalog items and their per-tier prices.
 * Everything happens in one transaction, mirroring the Slabs import apply
 * route's pattern.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload: ApplyPayload = await request.json();
    const { vendorId, newVendorName, newItems, changedItems, discontinuedIds } = payload;

    if (!vendorId && !newVendorName?.trim()) {
      return NextResponse.json(
        { error: "Select a vendor or provide a name for a new one" },
        { status: 400 },
      );
    }

    let createdCount = 0;
    let updatedCount = 0;
    let discontinuedCount = 0;

    await prisma.$transaction(
      async (tx: any) => {
        // 1. Resolve or create the vendor.
        let resolvedVendorId = vendorId;
        if (!resolvedVendorId) {
          const vendor = await tx.cabinetVendor.create({
            data: { name: newVendorName!.trim() },
          });
          resolvedVendorId = vendor.id;
        }

        // 2. Upsert every price tier referenced by the incoming items.
        const tierNames = new Set<string>();
        for (const item of newItems) {
          for (const p of item.prices) tierNames.add(p.tierName);
        }
        for (const change of changedItems) {
          for (const p of change.incoming.prices) tierNames.add(p.tierName);
        }

        const existingTiers = await tx.cabinetPriceTier.findMany({
          where: { vendorId: resolvedVendorId, name: { in: Array.from(tierNames) } },
        });
        const tierIdByName = new Map<string, string>(
          existingTiers.map((t: any) => [t.name, t.id]),
        );
        for (const name of tierNames) {
          if (!tierIdByName.has(name)) {
            const tier = await tx.cabinetPriceTier.create({
              data: { vendorId: resolvedVendorId, name },
            });
            tierIdByName.set(name, tier.id);
          }
        }

        // 3. Create new items + their prices, in bulk rather than one
        // create() + createMany() round-trip per item - a real import can be
        // 200-300+ rows, and awaiting that many sequential queries inside a
        // single interactive transaction reliably blew past Prisma's
        // transaction timeout in production (P2028 "Transaction not found" -
        // the transaction had already been closed server-side by the time a
        // later query in the loop tried to use it). `createManyAndReturn`
        // does the insert in one round trip and gives back the generated
        // ids; items are matched back up by `code` (unique per vendor, see
        // the @@unique([vendorId, code]) constraint) rather than by array
        // position, since a bulk insert's returned row order isn't
        // guaranteed to match the input order.
        if (newItems.length > 0) {
          const createdItems = await tx.cabinetCatalogItem.createManyAndReturn({
            data: newItems.map((item) => ({
              vendorId: resolvedVendorId,
              code: item.code,
              description: item.description,
              category: item.category,
              summaryBucket: item.summaryBucket as CabinetSummaryBucket,
              installationItemId: item.installationItemId || null,
              isActive: true,
            })),
          });
          const itemIdByCode = new Map<string, string>(
            createdItems.map((c: any) => [c.code, c.id]),
          );

          const newPriceRows: { itemId: string; tierId: string; price: number }[] = [];
          for (const item of newItems) {
            const itemId = itemIdByCode.get(item.code)!;
            for (const p of item.prices) {
              newPriceRows.push({
                itemId,
                tierId: tierIdByName.get(p.tierName)!,
                price: p.price,
              });
            }
          }
          if (newPriceRows.length > 0) {
            await tx.cabinetCatalogItemPrice.createMany({ data: newPriceRows });
          }
          createdCount = createdItems.length;
        }

        // 4. Update changed items + upsert their prices.
        for (const change of changedItems) {
          const incoming = change.incoming;
          await tx.cabinetCatalogItem.update({
            where: { id: change.existingId },
            data: {
              description: incoming.description,
              category: incoming.category,
              summaryBucket: incoming.summaryBucket as CabinetSummaryBucket,
              installationItemId: incoming.installationItemId || null,
              isActive: true,
            },
          });
          for (const p of incoming.prices) {
            const tierId = tierIdByName.get(p.tierName)!;
            await tx.cabinetCatalogItemPrice.upsert({
              where: { itemId_tierId: { itemId: change.existingId, tierId } },
              create: { itemId: change.existingId, tierId, price: p.price },
              update: { price: p.price },
            });
          }
          updatedCount++;
        }

        // 5. Mark discontinued items inactive (never deleted - preserves
        // history for any estimate that already references them).
        if (discontinuedIds.length > 0) {
          await tx.cabinetCatalogItem.updateMany({
            where: { id: { in: discontinuedIds } },
            data: { isActive: false },
          });
          discontinuedCount = discontinuedIds.length;
        }
      },
      { maxWait: 10000, timeout: 30000 },
    );

    return NextResponse.json({
      success: true,
      summary: { created: createdCount, updated: updatedCount, discontinued: discontinuedCount },
    });
  } catch (error: any) {
    console.error("Cabinet catalog import apply error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to apply changes" },
      { status: 500 },
    );
  }
}

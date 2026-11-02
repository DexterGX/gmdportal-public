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
  // Colors grouped under Levels (see lib/cabinetColorLevels.ts); null/absent
  // when the price list has one column per color.
  colorGroups?: {
    level: number;
    levelName: string;
    colors: { label: string; name: string; code: string }[];
  }[] | null;
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
    const colorGroups = payload.colorGroups && payload.colorGroups.length > 0 ? payload.colorGroups : null;

    if (!vendorId && !newVendorName?.trim()) {
      return NextResponse.json(
        { error: "Select a vendor or provide a name for a new one" },
        { status: 400 },
      );
    }

    let createdCount = 0;
    let updatedCount = 0;
    let discontinuedCount = 0;

    let appliedVendorId: string | null = vendorId || null;
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
        appliedVendorId = resolvedVendorId;

        // 2. Upsert every price tier referenced by the incoming items.
        const tierNames = new Set<string>();
        for (const item of newItems) {
          for (const p of item.prices) tierNames.add(p.tierName);
        }
        for (const change of changedItems) {
          for (const p of change.incoming.prices) tierNames.add(p.tierName);
        }
        if (colorGroups) {
          for (const g of colorGroups) tierNames.add(g.levelName);
        }

        const existingTiers = await tx.cabinetPriceTier.findMany({
          where: { vendorId: resolvedVendorId, name: { in: Array.from(tierNames) } },
        });
        const tierIdByName = new Map<string, string>(
          existingTiers.map((t: any) => [t.name, t.id]),
        );
        // A color switched off by "Clear price list" comes back when it is
        // imported again.
        const inactiveTierIds = existingTiers.filter((t: any) => !t.isActive).map((t: any) => t.id);
        if (inactiveTierIds.length > 0) {
          await tx.cabinetPriceTier.updateMany({
            where: { id: { in: inactiveTierIds } },
            data: { isActive: true },
          });
        }
        for (const name of tierNames) {
          if (!tierIdByName.has(name)) {
            const tier = await tx.cabinetPriceTier.create({
              data: { vendorId: resolvedVendorId, name },
            });
            tierIdByName.set(name, tier.id);
          }
        }

        // 2b. Colors grouped under Levels: one option per color pointing at its
        // Level tier. Colors no longer in the price list are switched off.
        if (colorGroups) {
          const wanted: { label: string; name: string; code: string; tierId: string; sortOrder: number }[] = [];
          let order = 0;
          for (const g of colorGroups) {
            const tierId = tierIdByName.get(g.levelName);
            if (!tierId) continue;
            for (const c of g.colors) {
              wanted.push({ label: c.label, name: c.name, code: c.code, tierId, sortOrder: order++ });
            }
          }
          const existingOptions = await tx.cabinetColorOption.findMany({
            where: { vendorId: resolvedVendorId },
          });
          const optionByLabel = new Map<string, any>(existingOptions.map((o: any) => [o.label, o]));
          const toCreate = wanted.filter((w) => !optionByLabel.has(w.label));
          if (toCreate.length > 0) {
            await tx.cabinetColorOption.createMany({
              data: toCreate.map((w) => ({ ...w, vendorId: resolvedVendorId })),
            });
          }
          for (const w of wanted) {
            const ex = optionByLabel.get(w.label);
            if (!ex) continue;
            if (
              ex.tierId !== w.tierId ||
              ex.name !== w.name ||
              ex.code !== w.code ||
              ex.sortOrder !== w.sortOrder ||
              !ex.isActive
            ) {
              await tx.cabinetColorOption.update({
                where: { id: ex.id },
                data: { tierId: w.tierId, name: w.name, code: w.code, sortOrder: w.sortOrder, isActive: true },
              });
            }
          }
          const wantedLabels = new Set(wanted.map((w) => w.label));
          const staleIds = existingOptions
            .filter((o: any) => o.isActive && !wantedLabels.has(o.label))
            .map((o: any) => o.id);
          if (staleIds.length > 0) {
            await tx.cabinetColorOption.updateMany({
              where: { id: { in: staleIds } },
              data: { isActive: false },
            });
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

    // Stamp "price list last updated" (shown on the estimate form). Outside the
    // transaction and best-effort: a failure here must never undo an import.
    if (appliedVendorId) {
      try {
        await (prisma as any).cabinetVendor.update({
          where: { id: appliedVendorId },
          data: { priceListUpdatedAt: new Date() },
        });
      } catch (err) {
        console.warn("Could not stamp price list update time:", err);
      }
    }

    return NextResponse.json({
      success: true,
      vendorId: appliedVendorId,
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

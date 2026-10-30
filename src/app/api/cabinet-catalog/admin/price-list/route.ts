import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";

const prismaAny = prisma as any;

// Rows per bulk statement (7 bind parameters per UPDATE row - far below Postgres's limit).
const UPDATE_BATCH_SIZE = 500;
const PRICE_DELETE_BATCH = 1000;
const PRICE_INSERT_BATCH = 2000;

/**
 * GET /api/cabinet-catalog/admin/price-list?vendorId=&includeInactive=0|1
 *
 * Admin-only browse for the "Price List" page (round 8); edits are saved
 * through PUT below (round 14):
 * every catalog item for one vendor, with its price at every one of that
 * vendor's price tiers side by side, plus when this vendor's catalog was
 * last touched by an import or an edit.
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
        provider: { select: { displayName: true, discount: true, factor: true, trueDiscount: true } },
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
        installationItemId: true,
        isActive: true,
        updatedAt: true,
        prices: { select: { tierId: true, price: true } },
      },
      orderBy: [{ code: "asc" }],
    });

    const installationItems = await prismaAny.cabinetInstallationServiceItem.findMany({
      where: { isActive: true },
      select: { id: true, code: true, description: true },
      orderBy: [{ sortOrder: "asc" }, { description: "asc" }],
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
        trueDiscount:
          vendor.provider && vendor.provider.trueDiscount !== null && vendor.provider.trueDiscount !== undefined
            ? Number(vendor.provider.trueDiscount)
            : null,
      },
      tiers,
      installationItems,
      lastUpdated,
      items: items.map((item: any) => ({
        id: item.id,
        code: item.code,
        description: item.description,
        category: item.category,
        summaryBucket: item.summaryBucket,
        installationItemId: item.installationItemId,
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

type SaveTier = { key: string; id: string | null; name: string };
type SaveItem = {
  id: string | null;
  code: string;
  description: string;
  category: string | null;
  summaryBucket: string;
  installationItemId: string | null;
  isActive: boolean;
  /** price by tier key; null / missing = not offered in that tier */
  prices: Record<string, number | null>;
};

const BUCKETS = ["STANDARD", "DOUBLE", "CUSTOM", "MISC"];

/**
 * PUT /api/cabinet-catalog/admin/price-list
 *
 * Saves the edits made on the Price List page in one transaction:
 *  - tiers (price columns): renamed / added / reordered; a column that is no
 *    longer in the list is deactivated (soft remove - its prices are kept,
 *    and it can come back by adding a column with the same name);
 *  - items: only the rows the page sent (changed or new) are written;
 *  - deleteItemIds: permanent delete, refused for items used in saved
 *    estimates (those are skipped and reported - discontinue them instead).
 */
export const maxDuration = 60;

export async function PUT(request: Request) {
  try {
    const { appRole } = await getProgramUserContext("cabinetEstimates");
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const vendorId = String(body.vendorId || "");
    const tiersIn: SaveTier[] = Array.isArray(body.tiers) ? body.tiers : [];
    const itemsIn: SaveItem[] = Array.isArray(body.items) ? body.items : [];
    const deleteItemIds: string[] = Array.isArray(body.deleteItemIds) ? body.deleteItemIds : [];

    if (!vendorId) {
      return NextResponse.json({ error: "vendorId is required" }, { status: 400 });
    }
    const vendor = await prismaAny.cabinetVendor.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // ---- validate ----
    const tierNames = tiersIn.map((t) => String(t.name || "").trim());
    if (tierNames.some((n) => !n)) {
      return NextResponse.json({ error: "Every price column needs a name." }, { status: 400 });
    }
    const lowerTierNames = tierNames.map((n) => n.toLowerCase());
    if (new Set(lowerTierNames).size !== lowerTierNames.length) {
      return NextResponse.json({ error: "Two price columns have the same name." }, { status: 400 });
    }
    for (const item of itemsIn) {
      const code = String(item.code || "").trim();
      if (!code) {
        return NextResponse.json({ error: "Every item needs a code." }, { status: 400 });
      }
      if (!String(item.description || "").trim()) {
        return NextResponse.json({ error: `Item ${code} needs a description.` }, { status: 400 });
      }
      if (!BUCKETS.includes(item.summaryBucket)) {
        return NextResponse.json({ error: `Item ${code} has an invalid bucket.` }, { status: 400 });
      }
    }

    const result = await prisma.$transaction(
      async (tx: any) => {
        // ---- tiers ----
        const existingTiers = await tx.cabinetPriceTier.findMany({ where: { vendorId } });
        const tierIdByKey = new Map<string, string>();
        const keptTierIds = new Set<string>();
        for (let index = 0; index < tiersIn.length; index++) {
          const t = tiersIn[index];
          const name = tierNames[index];
          const byId = t.id ? existingTiers.find((e: any) => e.id === t.id) : null;
          const byName = existingTiers.find(
            (e: any) => e.name.toLowerCase() === name.toLowerCase() && (!byId || e.id !== byId.id),
          );
          if (byName && !byId) {
            // a new column named like an old (maybe deactivated) one brings it back
            const updated = await tx.cabinetPriceTier.update({
              where: { id: byName.id },
              data: { isActive: true, sortOrder: index },
            });
            tierIdByKey.set(t.key, updated.id);
            keptTierIds.add(updated.id);
          } else if (byName && byId) {
            throw new Error(`There is already a price column called "${name}".`);
          } else if (byId) {
            await tx.cabinetPriceTier.update({
              where: { id: byId.id },
              data: { name, isActive: true, sortOrder: index },
            });
            tierIdByKey.set(t.key, byId.id);
            keptTierIds.add(byId.id);
          } else {
            const created = await tx.cabinetPriceTier.create({
              data: { vendorId, name, sortOrder: index, isActive: true },
            });
            tierIdByKey.set(t.key, created.id);
            keptTierIds.add(created.id);
          }
        }
        const removedTierIds = existingTiers
          .filter((e: any) => e.isActive && !keptTierIds.has(e.id))
          .map((e: any) => e.id);
        if (removedTierIds.length > 0) {
          await tx.cabinetPriceTier.updateMany({
            where: { id: { in: removedTierIds } },
            data: { isActive: false },
          });
          await tx.cabinetColorOption.updateMany({
            where: { vendorId, tierId: { in: removedTierIds } },
            data: { isActive: false },
          });
        }

        // ---- permanent deletes (first, so their codes are free again) ----
        let deleted = 0;
        const skipped: string[] = [];
        const deletedIds = new Set<string>();
        if (deleteItemIds.length > 0) {
          const candidates = await tx.cabinetCatalogItem.findMany({
            where: { vendorId, id: { in: deleteItemIds } },
            select: { id: true, code: true, _count: { select: { lineItems: true } } },
          });
          const deletable: string[] = [];
          for (const c of candidates) {
            if (c._count.lineItems === 0) deletable.push(c.id);
            else skipped.push(c.code);
          }
          if (deletable.length > 0) {
            const res = await tx.cabinetCatalogItem.deleteMany({ where: { id: { in: deletable } } });
            deleted = res.count;
            deletable.forEach((id) => deletedIds.add(id));
          }
        }

        // ---- items ----
        // Everything below is a handful of set-based queries (not one or more
        // per item), so a big edit stays well inside the transaction time.
        const allItems: { id: string; code: string }[] = await tx.cabinetCatalogItem.findMany({
          where: { vendorId },
          select: { id: true, code: true },
        });
        const codeById = new Map<string, string>();
        for (const row of allItems) if (!deletedIds.has(row.id)) codeById.set(row.id, row.code);

        const cleaned = itemsIn.map((item) => ({
          id: item.id,
          code: String(item.code).trim(),
          description: String(item.description).trim(),
          category: item.category && String(item.category).trim() ? String(item.category).trim() : null,
          summaryBucket: item.summaryBucket,
          installationItemId: item.installationItemId || null,
          isActive: Boolean(item.isActive),
          prices: item.prices || {},
        }));
        const toUpdate = cleaned.filter((item) => item.id && codeById.has(item.id));
        const toCreate = cleaned.filter((item) => !item.id);

        // Codes must stay unique in the vendor's list once all edits are applied.
        for (const item of toUpdate) codeById.set(item.id as string, item.code);
        const seenCodes = new Set<string>(codeById.values());
        if (seenCodes.size !== codeById.size) {
          const counts = new Map<string, number>();
          for (const code of Array.from(codeById.values())) counts.set(code, (counts.get(code) || 0) + 1);
          const dup = Array.from(counts.entries()).find(([, n]) => n > 1);
          throw new Error(`Another item already uses the code "${dup ? dup[0] : ""}".`);
        }
        for (const item of toCreate) {
          if (seenCodes.has(item.code)) throw new Error(`Another item already uses the code "${item.code}".`);
          seenCodes.add(item.code);
        }

        for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH_SIZE) {
          const batch = toUpdate.slice(i, i + UPDATE_BATCH_SIZE);
          const values = batch.map(
            (item) =>
              Prisma.sql`(${item.id}::text, ${item.code}::text, ${item.description}::text, ${item.category}::text, ${item.summaryBucket}::text, ${item.installationItemId}::text, ${item.isActive}::boolean)`,
          );
          await tx.$executeRaw`
            UPDATE "CabinetCatalogItem" AS t SET
              "code" = v.code,
              "description" = v.description,
              "category" = v.category,
              "summaryBucket" = v.bucket::"CabinetSummaryBucket",
              "installationItemId" = v.inst,
              "isActive" = v.active,
              "updatedAt" = NOW()
            FROM (VALUES ${Prisma.join(values)})
              AS v(id, code, description, category, bucket, inst, active)
            WHERE t."id" = v.id AND t."vendorId" = ${vendorId}`;
        }

        const createdIdByCode = new Map<string, string>();
        if (toCreate.length > 0) {
          const createdRows: { id: string; code: string }[] = await tx.cabinetCatalogItem.createManyAndReturn({
            data: toCreate.map((item) => ({
              vendorId,
              code: item.code,
              description: item.description,
              category: item.category,
              summaryBucket: item.summaryBucket,
              installationItemId: item.installationItemId,
              isActive: item.isActive,
            })),
            select: { id: true, code: true },
          });
          for (const row of createdRows) createdIdByCode.set(row.code, row.id);
        }

        // Prices of every edited/new item in the page's price columns: replaced as a set.
        const tierIds = Array.from(tierIdByKey.values());
        const priceItems: { itemId: string; prices: Record<string, number | null> }[] = [
          ...toUpdate.map((item) => ({ itemId: item.id as string, prices: item.prices })),
          ...toCreate
            .filter((item) => createdIdByCode.has(item.code))
            .map((item) => ({ itemId: createdIdByCode.get(item.code) as string, prices: item.prices })),
        ];
        if (priceItems.length > 0 && tierIds.length > 0) {
          const editedIds = priceItems.map((p) => p.itemId);
          const priceRows: { itemId: string; tierId: string; price: number }[] = [];
          for (const entry of priceItems) {
            for (const [key, tierId] of Array.from(tierIdByKey.entries())) {
              const value = entry.prices[key];
              if (value === null || value === undefined || !Number.isFinite(Number(value))) continue;
              priceRows.push({ itemId: entry.itemId, tierId, price: Number(value) });
            }
          }
          for (let i = 0; i < editedIds.length; i += PRICE_DELETE_BATCH) {
            await tx.cabinetCatalogItemPrice.deleteMany({
              where: { itemId: { in: editedIds.slice(i, i + PRICE_DELETE_BATCH) }, tierId: { in: tierIds } },
            });
          }
          for (let i = 0; i < priceRows.length; i += PRICE_INSERT_BATCH) {
            await tx.cabinetCatalogItemPrice.createMany({ data: priceRows.slice(i, i + PRICE_INSERT_BATCH) });
          }
        }
        const created = toCreate.length;
        const updated = toUpdate.length;

        return { created, updated, deleted, skipped, removedColumns: removedTierIds.length };
      },
      { maxWait: 10000, timeout: 60000 },
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("Error saving cabinet price list:", error);
    const message = error?.message && !String(error.message).includes("prisma")
      ? String(error.message)
      : "Failed to save the price list";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

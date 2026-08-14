import "server-only";
import { prisma } from "@/lib/prisma";

const prismaAny = prisma as any;

// There's only ever one row — a lightweight singleton rather than a full
// settings table, since this is just "which category groups to hide" from
// the printable Price List page (src/app/fabrication-orders/price-list).
export async function getHiddenPriceListCategories(): Promise<string[]> {
  try {
    const row = await prismaAny.fabricationPriceListSettings.findFirst();
    return row?.hiddenCategories ?? [];
  } catch {
    // Table doesn't exist yet until `prisma db push` is run for this new
    // model — fail open (show everything) instead of breaking the Settings
    // or Price List pages.
    return [];
  }
}

export async function setHiddenPriceListCategories(
  categories: string[],
): Promise<string[]> {
  if (!prismaAny.fabricationPriceListSettings) {
    // The FabricationPriceListSettings table/model was added to the schema
    // but `npx prisma generate` + `npx prisma db push` haven't been run
    // against this database yet, so the Prisma Client doesn't know about it.
    throw new Error(
      "This feature needs a database update before it can save. Run `npx prisma generate && npx prisma db push`, then try again.",
    );
  }
  const existing = await prismaAny.fabricationPriceListSettings.findFirst();
  if (existing) {
    const updated = await prismaAny.fabricationPriceListSettings.update({
      where: { id: existing.id },
      data: { hiddenCategories: categories },
    });
    return updated.hiddenCategories;
  }
  const created = await prismaAny.fabricationPriceListSettings.create({
    data: { hiddenCategories: categories },
  });
  return created.hiddenCategories;
}

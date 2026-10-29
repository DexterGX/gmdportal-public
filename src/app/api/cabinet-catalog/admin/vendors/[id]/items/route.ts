import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import { removeCabinetCatalogItemImages } from "@/lib/cabinetCatalogStorage";

const prismaAny = prisma as any;

async function requireAdmin() {
  const { user, appRole, isActive } = await getProgramUserContext("cabinetEstimates");
  if (!user || !isActive || appRole !== "admin") return null;
  return { user, appRole };
}

/**
 * GET /api/cabinet-catalog/admin/vendors/[id]/items
 *
 * Counts shown in the "Clear price list" confirmation: how many items and
 * prices would be deleted, and how many saved estimate lines point at them.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: vendorId } = await params;
    const vendor = await prismaAny.cabinetVendor.findUnique({
      where: { id: vendorId },
      select: { id: true, name: true },
    });
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    const [itemCount, priceCount, estimateLineCount] = await Promise.all([
      prismaAny.cabinetCatalogItem.count({ where: { vendorId } }),
      prismaAny.cabinetCatalogItemPrice.count({ where: { item: { vendorId } } }),
      prismaAny.cabinetEstimateLineItem.count({ where: { catalogItem: { vendorId } } }),
    ]);
    return NextResponse.json({ name: vendor.name, itemCount, priceCount, estimateLineCount });
  } catch (error: any) {
    console.error("Cabinet vendor items count error:", error);
    return NextResponse.json({ error: error.message || "Failed to load counts" }, { status: 500 });
  }
}

/**
 * DELETE /api/cabinet-catalog/admin/vendors/[id]/items
 * Body: { confirmName }  (must equal the vendor's name)
 *
 * PERMANENTLY deletes every imported catalog item (and, by cascade, its
 * prices) for the vendor, plus the item reference images in storage, and its
 * colors/groups (price tiers): deleted, or switched off when a saved estimate
 * still points at one. Kept: the vendor itself, its attached catalog PDF, and
 * every saved estimate. Estimate lines keep their saved price/description;
 * they just lose the link to the deleted catalog item.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: vendorId } = await params;
    const body = await request.json().catch(() => ({}));
    const vendor = await prismaAny.cabinetVendor.findUnique({
      where: { id: vendorId },
      select: { id: true, name: true },
    });
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    const confirmName = typeof body?.confirmName === "string" ? body.confirmName.trim() : "";
    if (confirmName.toLowerCase() !== String(vendor.name).trim().toLowerCase()) {
      return NextResponse.json(
        { error: "Type the vendor name exactly to confirm." },
        { status: 400 },
      );
    }

    const result = await prismaAny.cabinetCatalogItem.deleteMany({ where: { vendorId } });
    const imagesRemoved = await removeCabinetCatalogItemImages(vendorId);

    // Colors/groups (price tiers) go with the price list. A tier a saved
    // estimate points at can't be deleted without breaking that estimate, so
    // it is switched off instead: hidden from the Group / Color dropdown of
    // new estimates, still resolvable on the estimate that used it, and
    // switched back on if the same color is imported again.
    await prismaAny.cabinetColorOption.updateMany({
      where: { vendorId, isActive: true },
      data: { isActive: false },
    });
    const tiersDeleted = await prismaAny.cabinetPriceTier.deleteMany({
      where: { vendorId, estimates: { none: {} } },
    });
    const tiersHidden = await prismaAny.cabinetPriceTier.updateMany({
      where: { vendorId, isActive: true },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      itemsDeleted: result.count,
      imagesRemoved,
      tiersDeleted: tiersDeleted.count,
      tiersHidden: tiersHidden.count,
    });
  } catch (error: any) {
    console.error("Cabinet vendor clear price list error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to clear the price list" },
      { status: 500 },
    );
  }
}

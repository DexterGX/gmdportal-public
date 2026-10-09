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
 * prices) for the vendor, plus the item reference images in storage. Kept:
 * the vendor itself, its price tiers (colors/groups - saved estimates point
 * at them), its attached catalog PDF, and every saved estimate. Estimate
 * lines keep their saved price/description; they just lose the link to the
 * deleted catalog item.
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

    return NextResponse.json({
      success: true,
      itemsDeleted: result.count,
      imagesRemoved,
    });
  } catch (error: any) {
    console.error("Cabinet vendor clear price list error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to clear the price list" },
      { status: 500 },
    );
  }
}

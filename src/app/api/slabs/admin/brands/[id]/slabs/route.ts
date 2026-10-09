import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSlabAdmin } from "@/lib/slabsImportServer";

/**
 * GET /api/slabs/admin/brands/[id]/slabs
 * Counts shown in the "Delete price list" confirmation.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireSlabAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const brand = await prisma.slabBrandConfig.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const byStatus = await prisma.slab.groupBy({
      by: ["status"],
      where: { brandId: id },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of byStatus) {
      counts[row.status] = row._count._all;
      total += row._count._all;
    }
    return NextResponse.json({ success: true, brandName: brand.name, total, counts });
  } catch (error: any) {
    console.error("Slab price list count error:", error);
    return NextResponse.json({ error: error.message || "Failed to load the price list" }, { status: 500 });
  }
}

/**
 * DELETE /api/slabs/admin/brands/[id]/slabs
 * Body: { confirmName } - must match the brand name.
 *
 * PERMANENTLY deletes every slab in this brand's price list so it can be
 * re-imported from scratch. The brand itself (pricing settings, logo,
 * contacts, notes) is kept. Nothing else in the database references
 * individual slabs, so no other records are affected.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireSlabAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const brand = await prisma.slabBrandConfig.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const confirmName = typeof body?.confirmName === "string" ? body.confirmName.trim().toLowerCase() : "";
    if (confirmName !== brand.name.trim().toLowerCase()) {
      return NextResponse.json({ error: "Type the brand name exactly to confirm." }, { status: 400 });
    }

    const result = await prisma.slab.deleteMany({ where: { brandId: brand.id } });
    await prisma.slabBrandConfig.update({ where: { id: brand.id }, data: { lastUpdate: new Date() } });

    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error: any) {
    console.error("Slab price list delete error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete the price list" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import {
  removeCabinetCatalogFile,
  resolveCabinetCatalogPublicUrl,
} from "@/lib/cabinetCatalogStorage";

const prismaAny = prisma as any;

async function requireAdmin() {
  const { user, appRole, isActive } = await getCurrentUserWithRole();
  if (!user || !isActive || appRole !== "admin") return null;
  return { user, appRole };
}

/**
 * POST /api/cabinet-catalog/admin/vendors/[id]/catalog
 *
 * Step 2 of attaching (or replacing) a vendor's reference catalog PDF -
 * see the schema comment on CabinetVendor.catalogPdfUrl. The browser has
 * already uploaded the actual PDF bytes straight to Supabase Storage via a
 * signed URL from .../catalog/sign-upload (a real catalog can be 100MB+,
 * well past what a normal Vercel serverless function can accept as a
 * request body) - this call just takes the resulting storage path, resolves
 * its public URL, and points the vendor at it. Never touches
 * CabinetCatalogItem prices/codes; this is purely the source document for
 * (a) better AI classification hints during price-list import (see
 * cabinetCatalogImportAi.ts) and (b) the "Extract item images" action (see
 * .../extract-images/route.ts). Re-uploading replaces the previous file
 * outright - only the latest catalog is kept, per Round 13's ask.
 *
 * Body: { storagePath, fileName }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: vendorId } = await params;
    const vendor = await prismaAny.cabinetVendor.findUnique({
      where: { id: vendorId },
      select: { id: true, catalogPdfUrl: true },
    });
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const storagePath = typeof body?.storagePath === "string" ? body.storagePath.trim() : "";
    const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "catalog.pdf";
    if (!storagePath) {
      return NextResponse.json({ error: "storagePath is required" }, { status: 400 });
    }
    // Defense in depth: the signed-upload step (sign-upload/route.ts)
    // already scopes the path to this vendor, but double check here too
    // rather than trusting a client-supplied path blindly.
    if (!storagePath.startsWith(`vendors/${vendorId}/`)) {
      return NextResponse.json({ error: "storagePath does not belong to this vendor" }, { status: 400 });
    }

    const url = resolveCabinetCatalogPublicUrl(storagePath);
    if (!url) {
      return NextResponse.json({ error: "Failed to resolve uploaded file URL" }, { status: 500 });
    }

    const previousUrl = vendor.catalogPdfUrl as string | null;

    const updated = await prismaAny.cabinetVendor.update({
      where: { id: vendorId },
      data: {
        catalogPdfUrl: url,
        catalogPdfFileName: fileName,
        catalogUploadedAt: new Date(),
      },
      select: { catalogPdfUrl: true, catalogPdfFileName: true, catalogUploadedAt: true },
    });

    if (previousUrl && previousUrl !== url) {
      await removeCabinetCatalogFile(previousUrl);
    }

    return NextResponse.json({
      success: true,
      catalogPdfUrl: updated.catalogPdfUrl,
      catalogPdfFileName: updated.catalogPdfFileName,
      catalogUploadedAt: updated.catalogUploadedAt
        ? updated.catalogUploadedAt.toISOString()
        : null,
    });
  } catch (error: any) {
    console.error("Cabinet vendor catalog upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload catalog" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/cabinet-catalog/admin/vendors/[id]/catalog
 *
 * Removes the attached catalog (file + the vendor's reference to it). Does
 * NOT clear any CabinetCatalogItem.catalogImageUrl already extracted from
 * it - those stay as a last-known-good reference image until a future
 * "Extract item images" run replaces them.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: vendorId } = await params;
    const vendor = await prismaAny.cabinetVendor.findUnique({
      where: { id: vendorId },
      select: { id: true, catalogPdfUrl: true },
    });
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    await prismaAny.cabinetVendor.update({
      where: { id: vendorId },
      data: { catalogPdfUrl: null, catalogPdfFileName: null, catalogUploadedAt: null },
    });

    if (vendor.catalogPdfUrl) {
      await removeCabinetCatalogFile(vendor.catalogPdfUrl as string);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Cabinet vendor catalog delete error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove catalog" },
      { status: 500 },
    );
  }
}

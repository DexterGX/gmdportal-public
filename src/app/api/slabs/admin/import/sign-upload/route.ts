import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSlabAdmin } from "@/lib/slabsImportServer";
import { createSlabImportUploadTarget, isSupportedImportFile } from "@/lib/slabsImportStorage";

/**
 * POST /api/slabs/admin/import/sign-upload
 * Body: { brandId, fileName }
 *
 * Step 1 of an import: returns a short-lived signed Supabase Storage upload
 * URL so the browser uploads the price list straight to storage (PDFs can be
 * larger than Vercel's request-body limit). The returned `path` is then
 * passed to .../analyze and .../extract.
 */
export async function POST(request: Request) {
  try {
    if (!(await requireSlabAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const brandId = typeof body?.brandId === "string" ? body.brandId : "";
    const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";

    if (!brandId) return NextResponse.json({ error: "Brand not selected" }, { status: 400 });
    if (!fileName || !isSupportedImportFile(fileName)) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload a PDF, Excel (.xlsx/.xls) or CSV file." },
        { status: 400 },
      );
    }

    const brand = await prisma.slabBrandConfig.findUnique({ where: { id: brandId }, select: { id: true } });
    if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const target = await createSlabImportUploadTarget(brandId, fileName);
    return NextResponse.json({ success: true, ...target });
  } catch (error: any) {
    console.error("Slab import sign-upload error:", error);
    return NextResponse.json({ error: error.message || "Failed to prepare upload" }, { status: 500 });
  }
}

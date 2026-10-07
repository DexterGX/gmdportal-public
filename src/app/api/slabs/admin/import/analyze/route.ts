import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSlabAdmin } from "@/lib/slabsImportServer";
import { downloadSlabImportFile, isValidImportPath } from "@/lib/slabsImportStorage";
import { planSlabImport } from "@/lib/slabsImportAi";

export const maxDuration = 60;

/**
 * POST /api/slabs/admin/import/analyze
 * Body: { brandId, storagePath, fileName }
 *
 * Step 2: decides how the uploaded file will be read.
 *  - kind "template": the file is already in the GMD template - rows are
 *    returned right away, no AI involved.
 *  - kind "pdf" / "sheet": returns the list of chunks; the browser then calls
 *    .../extract once per chunk (AI) and shows progress.
 */
export async function POST(request: Request) {
  try {
    if (!(await requireSlabAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const brandId = typeof body?.brandId === "string" ? body.brandId : "";
    const fileName = typeof body?.fileName === "string" ? body.fileName : "";
    const storagePath = body?.storagePath;

    if (!brandId) return NextResponse.json({ error: "Brand not selected" }, { status: 400 });
    if (!isValidImportPath(storagePath, brandId)) {
      return NextResponse.json({ error: "Invalid upload reference" }, { status: 400 });
    }

    const brand = await prisma.slabBrandConfig.findUnique({ where: { id: brandId }, select: { id: true } });
    if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const buffer = await downloadSlabImportFile(storagePath);
    let plan;
    try {
      plan = await planSlabImport(buffer, fileName || storagePath);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Could not read this file" }, { status: 400 });
    }

    if (plan.kind === "template" && plan.rows.length === 0) {
      return NextResponse.json(
        { error: "The template file has headers but no slab rows." },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, ...plan });
  } catch (error: any) {
    console.error("Slab import analyze error:", error);
    return NextResponse.json({ error: error.message || "Failed to analyze file" }, { status: 500 });
  }
}

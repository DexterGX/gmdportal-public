import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSlabAdmin } from "@/lib/slabsImportServer";
import { downloadSlabImportFile, isValidImportPath } from "@/lib/slabsImportStorage";
import { extractSlabImportChunk, type ExistingSlabHint } from "@/lib/slabsImportAi";
import { thicknessEnumToString } from "@/lib/slabsImport";

// One chunk = 2 PDF pages or 60 sheet rows, but a dense page can still take
// the AI a couple of minutes (and gets re-read page by page if it overflows).
export const maxDuration = 300;

/**
 * POST /api/slabs/admin/import/extract
 * Body: { brandId, storagePath, fileName, chunkIndex, notes? }
 *
 * Step 3 (AI files only): reads ONE chunk of the uploaded price list with
 * Claude and returns its rows in GMD template form. Nothing is saved.
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
    const chunkIndex = Number(body?.chunkIndex);
    const notes = typeof body?.notes === "string" ? body.notes.slice(0, 4000) : null;

    if (!brandId) return NextResponse.json({ error: "Brand not selected" }, { status: 400 });
    if (!isValidImportPath(storagePath, brandId)) {
      return NextResponse.json({ error: "Invalid upload reference" }, { status: 400 });
    }
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      return NextResponse.json({ error: "Invalid chunk" }, { status: 400 });
    }

    const brand = await prisma.slabBrandConfig.findUnique({
      where: { id: brandId },
      select: { id: true, name: true },
    });
    if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

    const existing = await prisma.slab.findMany({
      where: { brandId },
      select: {
        color: true,
        finish: true,
        thickness: true,
        heightIn: true,
        widthIn: true,
        series: true,
        providerCode: true,
      },
      orderBy: [{ color: "asc" }],
    });
    const existingSlabs: ExistingSlabHint[] = existing.map((s) => ({
      color: s.color,
      finish: s.finish,
      thickness: thicknessEnumToString(s.thickness),
      heightIn: parseFloat(s.heightIn.toString()),
      widthIn: parseFloat(s.widthIn.toString()),
      series: s.series,
      code: s.providerCode || null,
    }));

    const buffer = await downloadSlabImportFile(storagePath);
    try {
      const result = await extractSlabImportChunk(buffer, fileName || storagePath, chunkIndex, {
        brandName: brand.name,
        existingSlabs,
        notes,
      });
      return NextResponse.json({ success: true, ...result });
    } catch (err: any) {
      console.error("Slab import AI extraction failed:", err);
      return NextResponse.json({ error: err.message || "AI reading failed" }, { status: 502 });
    }
  } catch (error: any) {
    console.error("Slab import extract error:", error);
    return NextResponse.json({ error: error.message || "Failed to read file" }, { status: 500 });
  }
}

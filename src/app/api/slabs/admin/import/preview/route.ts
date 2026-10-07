import { NextResponse } from "next/server";
import {
  computeRowsDiff,
  requireSlabAdmin,
  sanitizeTemplateRows,
  serializeExistingSlab,
} from "@/lib/slabsImportServer";

/**
 * POST /api/slabs/admin/import/preview
 * Body: { brandId, rows: SlabTemplateRow[] }
 *
 * Compares the reviewed/edited template rows against the brand's current
 * slabs and returns what Apply would do (new / updated / discontinued).
 * Nothing is written. Rows with blocking errors return 422 + per-row issues.
 */
export async function POST(request: Request) {
  try {
    if (!(await requireSlabAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const brandId = typeof body?.brandId === "string" ? body.brandId : "";
    if (!brandId) return NextResponse.json({ error: "Brand not selected" }, { status: 400 });

    const rows = sanitizeTemplateRows(body?.rows);
    const result = await computeRowsDiff(brandId, rows);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, issues: result.issues }, { status: result.status });
    }

    const { diff } = result;
    return NextResponse.json({
      success: true,
      diff: {
        newSlabs: diff.newSlabs,
        changedSlabs: diff.changedSlabs.map((change) => ({
          existing: serializeExistingSlab(change.existing as any),
          incoming: change.incoming,
          changes: change.changes,
        })),
        discontinuedSlabs: diff.discontinuedSlabs.map((slab) => serializeExistingSlab(slab as any)),
      },
      summary: {
        newCount: diff.newSlabs.length,
        changedCount: diff.changedSlabs.length,
        discontinuedCount: diff.discontinuedSlabs.length,
        unchangedCount: rows.length - diff.newSlabs.length - diff.changedSlabs.length,
        alreadyUnavailableCount: result.alreadyUnavailableCount,
        totalProcessed: rows.length,
      },
    });
  } catch (error: any) {
    console.error("Import preview error:", error);
    return NextResponse.json({ error: error.message || "Failed to build preview" }, { status: 500 });
  }
}

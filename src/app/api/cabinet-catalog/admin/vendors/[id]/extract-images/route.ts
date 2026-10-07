import { NextResponse } from "next/server";
import { getProgramUserContext } from "@/lib/programPermissions";
import { extractCatalogItemVisuals } from "@/lib/cabinetCatalogVisuals";

async function requireAdmin() {
  const { user, appRole, isActive } = await getProgramUserContext("cabinetEstimates");
  if (!user || !isActive || appRole !== "admin") return null;
  return { user, appRole };
}

// A large/image-heavy catalog gets split into several page-range chunks
// (see prepareCatalogPdfPageChunks in cabinetCatalogPdf.ts), each its own
// Claude call plus a render/crop pass - so the whole run can legitimately
// take a few minutes for an 80+ page catalog, not just a few seconds.
// IMPORTANT: Vercel's Hobby plan hard-caps every function at 60s no matter
// what this is set to, so a big catalog WILL time out there. Pro (and
// above) allows up to 300s by default - if extraction is timing out in
// production, this is almost certainly why; either upgrade the plan or
// ask about breaking a very large catalog's extraction into multiple
// smaller manual runs.
export const maxDuration = 300;

/**
 * POST /api/cabinet-catalog/admin/vendors/[id]/extract-images
 *
 * Admin-only. Re-reads this vendor's attached catalog PDF and (re)populates
 * CabinetCatalogItem.catalogImageUrl for every active item it can confidently
 * match - see cabinetCatalogVisuals.ts. Never touches prices/codes/
 * descriptions. Safe to re-run any time (e.g. after re-uploading a newer
 * catalog, or after a fresh price-list import adds new codes) - it always
 * starts from the vendor's current catalog PDF and current active items.
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
    const result = await extractCatalogItemVisuals(vendorId);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Cabinet catalog image extraction error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to extract catalog images" },
      { status: 500 },
    );
  }
}

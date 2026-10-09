import { NextResponse } from "next/server";
import { getProgramUserContext } from "@/lib/programPermissions";
import { downloadCabinetImportFile, isValidCabinetImportPath } from "@/lib/cabinetImportStorage";
import { planCabinetPdf } from "@/lib/cabinetPdfImportAi";

export const maxDuration = 60;

/**
 * POST /api/cabinet-catalog/admin/import/pdf-analyze
 * Body: { storagePath }
 *
 * Step 2 of a PDF price-list import: opens the uploaded PDF and returns the
 * list of page chunks; the browser then calls .../pdf-extract once per chunk.
 */
export async function POST(request: Request) {
  try {
    const { user, appRole, isActive } = await getProgramUserContext("cabinetEstimates");
    if (!user || !isActive || appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const storagePath = body?.storagePath;
    if (!isValidCabinetImportPath(storagePath, user.id)) {
      return NextResponse.json({ error: "Invalid upload reference" }, { status: 400 });
    }
    const buffer = await downloadCabinetImportFile(storagePath);
    try {
      const plan = await planCabinetPdf(buffer);
      return NextResponse.json({ success: true, ...plan });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Could not read this file" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Cabinet import pdf-analyze error:", error);
    return NextResponse.json({ error: error.message || "Failed to analyze file" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getProgramUserContext } from "@/lib/programPermissions";
import { createCabinetImportUploadTarget } from "@/lib/cabinetImportStorage";

/**
 * POST /api/cabinet-catalog/admin/import/pdf-sign-upload
 * Body: { fileName }
 *
 * Step 1 of a PDF price-list import: returns a short-lived signed storage
 * upload URL so the browser uploads the PDF straight to storage (it can be
 * larger than Vercel's request-body limit). The returned `path` is then passed
 * to .../pdf-analyze and .../pdf-extract.
 */
export async function POST(request: Request) {
  try {
    const { user, appRole, isActive } = await getProgramUserContext("cabinetEstimates");
    if (!user || !isActive || appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";
    if (!fileName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported here" }, { status: 400 });
    }
    const target = await createCabinetImportUploadTarget(user.id);
    return NextResponse.json({ success: true, ...target });
  } catch (error: any) {
    console.error("Cabinet import pdf-sign-upload error:", error);
    return NextResponse.json({ error: error.message || "Failed to prepare upload" }, { status: 500 });
  }
}

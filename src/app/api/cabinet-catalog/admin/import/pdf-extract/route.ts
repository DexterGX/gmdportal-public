import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import { downloadCabinetImportFile, isValidCabinetImportPath } from "@/lib/cabinetImportStorage";
import { extractCabinetPdfChunk } from "@/lib/cabinetPdfImportAi";

const prismaAny = prisma as any;

// One chunk = 2 PDF pages; a dense page can still take the AI a couple of minutes.
export const maxDuration = 300;

/**
 * POST /api/cabinet-catalog/admin/import/pdf-extract
 * Body: { storagePath, chunkIndex, vendorId?, vendorName?, notes?, knownColumns? }
 *
 * Step 3 of a PDF price-list import: reads ONE chunk of the uploaded PDF with
 * Claude and returns it as a table (columns + rows). Nothing is saved.
 */
export async function POST(request: Request) {
  try {
    const { user, appRole, isActive } = await getProgramUserContext("cabinetEstimates");
    if (!user || !isActive || appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const storagePath = body?.storagePath;
    const chunkIndex = Number(body?.chunkIndex);
    const notes = typeof body?.notes === "string" ? body.notes.slice(0, 4000) : null;
    const knownColumns = Array.isArray(body?.knownColumns)
      ? body.knownColumns.filter((c: unknown): c is string => typeof c === "string").slice(0, 60)
      : null;

    if (!isValidCabinetImportPath(storagePath, user.id)) {
      return NextResponse.json({ error: "Invalid upload reference" }, { status: 400 });
    }
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      return NextResponse.json({ error: "Invalid chunk" }, { status: 400 });
    }

    let vendorName = typeof body?.vendorName === "string" ? body.vendorName.trim() : "";
    if (typeof body?.vendorId === "string" && body.vendorId) {
      const vendor = await prismaAny.cabinetVendor.findUnique({
        where: { id: body.vendorId },
        select: { name: true },
      });
      if (vendor?.name) vendorName = vendor.name;
    }

    const buffer = await downloadCabinetImportFile(storagePath);
    try {
      const result = await extractCabinetPdfChunk(buffer, chunkIndex, {
        vendorName: vendorName || "this vendor",
        notes,
        knownColumns,
      });
      return NextResponse.json({ success: true, ...result });
    } catch (err: any) {
      console.error("Cabinet import PDF AI extraction failed:", err);
      return NextResponse.json({ error: err.message || "AI reading failed" }, { status: 502 });
    }
  } catch (error: any) {
    console.error("Cabinet import pdf-extract error:", error);
    return NextResponse.json({ error: error.message || "Failed to read file" }, { status: 500 });
  }
}

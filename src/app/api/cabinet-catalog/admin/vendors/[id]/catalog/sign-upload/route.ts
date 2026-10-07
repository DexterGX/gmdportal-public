import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProgramUserContext } from "@/lib/programPermissions";
import { createCabinetCatalogPdfUploadTarget } from "@/lib/cabinetCatalogStorage";

const prismaAny = prisma as any;

async function requireAdmin() {
  const { user, appRole, isActive } = await getProgramUserContext("cabinetEstimates");
  if (!user || !isActive || appRole !== "admin") return null;
  return { user, appRole };
}

/**
 * POST /api/cabinet-catalog/admin/vendors/[id]/catalog/sign-upload
 *
 * Step 1 of the large-catalog upload flow (see cabinetCatalogStorage.ts's
 * createCabinetCatalogPdfUploadTarget). Body: { fileName }. Returns a
 * short-lived signed Supabase Storage upload URL the BROWSER uploads
 * directly to - the actual PDF bytes never pass through this Next.js
 * server, so Vercel's serverless request-body size limit never applies to
 * it. Once that upload succeeds, the client calls .../catalog (POST) with
 * the returned path to finish attaching it to the vendor.
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
      select: { id: true },
    });
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";
    if (!fileName) {
      return NextResponse.json({ error: "fileName is required" }, { status: 400 });
    }
    if (!fileName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    const target = await createCabinetCatalogPdfUploadTarget(vendorId, fileName);
    return NextResponse.json({ success: true, ...target });
  } catch (error: any) {
    console.error("Cabinet vendor catalog sign-upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to prepare upload" },
      { status: 500 },
    );
  }
}

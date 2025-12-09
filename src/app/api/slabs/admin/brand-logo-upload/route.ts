import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { promises as fs } from "fs";
import path from "path";

/**
 * POST /api/slabs/admin/brand-logo-upload
 * Upload and save a brand logo
 */
export async function POST(request: Request) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const brandId = formData.get("brandId") as string | null;
    const file = formData.get("file");

    console.log("Upload attempt - brandId:", brandId, "file type:", typeof file, "file:", file);

    if (!brandId || !file) {
      return NextResponse.json(
        { error: "Missing brandId or file" },
        { status: 400 }
      );
    }

    // Ensure file is a Blob/File
    if (!(file instanceof Blob)) {
      console.error("File is not a Blob. Type:", typeof file, "Constructor:", file?.constructor?.name);
      return NextResponse.json(
        { error: `Invalid file format. Received: ${typeof file}` },
        { status: 400 }
      );
    }

    // Read file as buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const fileName = file instanceof File && file.name 
      ? file.name 
      : 'logo.png';
    const ext = fileName.split(".").pop() ?? "png";
    const uniqueFileName = `${brandId}-${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "slab-logos");
    const filePath = path.join(uploadDir, uniqueFileName);

    // Ensure directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, buffer);

    // Public URL
    const logoUrl = `/slab-logos/${uniqueFileName}`;

    // Update database
    await prisma.slabBrandConfig.update({
      where: { id: brandId },
      data: { logoUrl },
    });

    return NextResponse.json({ logoUrl });
  } catch (error: any) {
    console.error("Brand logo upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload logo" },
      { status: 500 }
    );
  }
}

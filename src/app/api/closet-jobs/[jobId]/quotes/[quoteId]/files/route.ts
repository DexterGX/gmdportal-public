import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/server";

const BUCKET_NAME = "closet-quotes";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "image/gif",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string; quoteId: string }> }
) {
  try {
    const { jobId, quoteId } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, appRole } = await getCurrentUserWithRole();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    // Verify quote exists
    const quote = await prisma.closetQuote.findUnique({
      where: { id: quoteId },
      include: { closetJob: true },
    });

    if (!quote || quote.closetJobId !== jobId) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Permission check
    if (appRole !== "admin" && quote.closetJob.installerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const uploadedFiles = [];

    for (const file of files) {
      // Validate file
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            error: `Invalid file type: ${
              file.type
            }. Allowed types: ${ALLOWED_TYPES.join(", ")}`,
          },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File too large: ${file.name}. Max size is 10MB` },
          { status: 400 }
        );
      }

      // Generate unique file path
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `closet-jobs/${jobId}/quotes/${quoteId}/${timestamp}-${sanitizedName}`;

      // Upload to Supabase Storage
      const fileBuffer = await file.arrayBuffer();
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(filePath, fileBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        console.error("Supabase upload error:", error);
        return NextResponse.json(
          { error: `Failed to upload ${file.name}: ${error.message}` },
          { status: 500 }
        );
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      // Save to database
      const savedFile = await prisma.closetQuoteFile.create({
        data: {
          closetQuoteId: quoteId,
          fileUrl: urlData.publicUrl,
          type: "3D_RENDER",
          caption: file.name,
          uploadedById: user.id,
        },
      });

      uploadedFiles.push(savedFile);
    }

    return NextResponse.json({ files: uploadedFiles }, { status: 201 });
  } catch (error: any) {
    console.error("Error uploading files:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

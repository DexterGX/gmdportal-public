import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/server";

const BUCKET_NAME = "closet-quotes";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES_PER_QUOTE = 30;
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

    const { user, appRole } = await getProgramUserContext("closetJobs");
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    // Verify quote exists
    const quote = await prisma.closetQuote.findUnique({
      where: { id: quoteId },
      include: {
        closetJob: true,
        files: {
          select: { id: true },
        },
      },
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

    if (quote.files.length + files.length > MAX_FILES_PER_QUOTE) {
      return NextResponse.json(
        {
          error: `This quote can have up to ${MAX_FILES_PER_QUOTE} images. You already have ${quote.files.length}.`,
        },
        { status: 400 }
      );
    }

    for (const file of files) {
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
    }

    const uploadedFiles = [];
    const uploadedFilePaths: string[] = [];
    const createdDbFileIds: string[] = [];

    try {
      for (const file of files) {
        // Generate unique file path
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `closet-jobs/${jobId}/quotes/${quoteId}/${timestamp}-${sanitizedName}`;

        // Upload to Supabase Storage
        const fileBuffer = await file.arrayBuffer();
        const { error } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .upload(filePath, fileBuffer, {
            contentType: file.type,
            upsert: false,
          });

        if (error) {
          throw new Error(`Failed to upload ${file.name}: ${error.message}`);
        }
        uploadedFilePaths.push(filePath);

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

        createdDbFileIds.push(savedFile.id);
        uploadedFiles.push(savedFile);
      }
    } catch (uploadError: any) {
      // Best-effort cleanup to keep upload behavior all-or-nothing.
      if (createdDbFileIds.length > 0) {
        await prisma.closetQuoteFile.deleteMany({
          where: { id: { in: createdDbFileIds } },
        });
      }

      if (uploadedFilePaths.length > 0) {
        await supabaseAdmin.storage.from(BUCKET_NAME).remove(uploadedFilePaths);
      }

      return NextResponse.json(
        { error: uploadError.message || "Failed to upload files" },
        { status: 500 }
      );
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

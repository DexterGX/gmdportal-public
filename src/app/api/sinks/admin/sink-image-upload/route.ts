import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/authHelpers";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/server";

const BUCKET_NAME = process.env.SUPABASE_SINKS_BUCKET || "sinks-assets";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "image/gif",
];

function slugifyModelSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "model";
}

function extractStoragePathFromUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  const marker = `${BUCKET_NAME}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  return url.slice(markerIndex + marker.length);
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getCurrentUserWithRole();
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const sinkId = String(formData.get("sinkId") ?? "").trim();
    const file = formData.get("file");

    if (!sinkId || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing sinkId or file" },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type: ${file.type}. Allowed types: ${ALLOWED_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Max size is 10MB" },
        { status: 400 },
      );
    }

    const prismaAny = prisma as any;
    const existingSink = await prismaAny.sink.findUnique({
      where: { id: sinkId },
      select: { id: true, brandId: true, model: true, imageUrl: true },
    });

    if (!existingSink) {
      return NextResponse.json({ error: "Sink not found" }, { status: 404 });
    }

    const fileName = file.name || "sink.png";
    const ext = fileName.split(".").pop() || "png";
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const storagePath = `sinks/models/${existingSink.brandId}/${slugifyModelSegment(existingSink.model)}/${unique}`;

    const existingModelImage = await prismaAny.sinkModelImage.findUnique({
      where: {
        brandId_model: {
          brandId: existingSink.brandId,
          model: existingSink.model,
        },
      },
      select: { id: true, imageUrl: true },
    });

    const uploadResult = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(storagePath, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadResult.error) {
      return NextResponse.json(
        { error: `Supabase upload failed: ${uploadResult.error.message}` },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

    if (!publicUrl) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove([storagePath]);
      return NextResponse.json(
        { error: "Failed to resolve uploaded image URL" },
        { status: 500 },
      );
    }

    await prismaAny.$transaction(async (tx: any) => {
      await tx.sinkModelImage.upsert({
        where: {
          brandId_model: {
            brandId: existingSink.brandId,
            model: existingSink.model,
          },
        },
        update: { imageUrl: publicUrl },
        create: {
          brandId: existingSink.brandId,
          model: existingSink.model,
          imageUrl: publicUrl,
        },
      });

      await tx.sink.updateMany({
        where: {
          brandId: existingSink.brandId,
          model: existingSink.model,
        },
        data: { imageUrl: publicUrl },
      });
    });

    const previousStoragePath = extractStoragePathFromUrl(existingModelImage?.imageUrl);
    if (previousStoragePath) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove([previousStoragePath]);
    }

    return NextResponse.json({ imageUrl: publicUrl });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to upload sink image" },
      { status: 500 },
    );
  }
}

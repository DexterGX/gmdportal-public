import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { getProgramUserContext } from "@/lib/programPermissions";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/server";

const BUCKET_NAME = process.env.SUPABASE_SINKS_BUCKET || "sinks-assets";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "image/gif",
];

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appRole } = await getProgramUserContext("sinks");
    if (appRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const brandId = String(formData.get("brandId") ?? "").trim();
    const file = formData.get("file");

    if (!brandId || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing brandId or file" },
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
        { error: "File too large. Max size is 5MB" },
        { status: 400 },
      );
    }

    const prismaAny = prisma as any;
    const existingBrand = await prismaAny.sinkBrand.findUnique({
      where: { id: brandId },
      select: { id: true, logoUrl: true },
    });

    if (!existingBrand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const fileName = file.name || "logo.png";
    const ext = fileName.split(".").pop() || "png";
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const storagePath = `sinks/brands/${brandId}/logos/${unique}`;

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
        { error: "Failed to resolve uploaded logo URL" },
        { status: 500 },
      );
    }

    const previousLogoUrl = existingBrand.logoUrl
      ? String(existingBrand.logoUrl)
      : null;

    await prismaAny.sinkBrand.update({
      where: { id: brandId },
      data: { logoUrl: publicUrl },
    });

    if (previousLogoUrl && previousLogoUrl.includes(`${BUCKET_NAME}/`)) {
      const marker = `${BUCKET_NAME}/`;
      const markerIndex = previousLogoUrl.indexOf(marker);
      const previousStoragePath =
        markerIndex !== -1
          ? previousLogoUrl.slice(markerIndex + marker.length)
          : null;
      if (previousStoragePath) {
        await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .remove([previousStoragePath]);
      }
    }

    return NextResponse.json({ logoUrl: publicUrl });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to upload sink brand logo" },
      { status: 500 },
    );
  }
}

import "server-only";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/server";

const prismaAny = prisma as any;
const BUCKET_NAME = "fabrication-orders";
const MAX_IMAGES_PER_AREA = 8;

function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  return { buffer, contentType };
}

export async function saveOrderAreaImages(
  areaId: string,
  newImages: Array<{ dataUrl: string; caption?: string }>,
  uploadedById: string,
) {
  const limited = newImages.slice(0, MAX_IMAGES_PER_AREA);
  const created = [];

  for (let i = 0; i < limited.length; i += 1) {
    const parsed = parseDataUrl(limited[i].dataUrl);
    if (!parsed) continue;

    const ext = parsed.contentType.split("/")[1] || "png";
    const filePath = `areas/${areaId}/${Date.now()}-${i}.${ext}`;

    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, parsed.buffer, {
        contentType: parsed.contentType,
        upsert: false,
      });

    if (error) {
      // Best-effort: skip this image rather than failing the whole save.
      console.error("Failed to upload fabrication order image", error);
      continue;
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const record = await prismaAny.fabricationOrderImage.create({
      data: {
        areaId,
        fileUrl: urlData.publicUrl,
        caption: limited[i].caption || null,
        uploadedById,
      },
    });
    created.push(record);
  }

  return created;
}

// "Save as New" duplicates an order rather than editing it in place, so an
// area's already-uploaded images need to carry over to the new area record
// too. We copy the actual file bytes into a new Storage path (rather than
// pointing a new row at the same fileUrl) so the new order's images are
// fully independent — deleting an image on either order can never delete
// the file the other order is still displaying.
export async function copyOrderAreaImages(
  areaId: string,
  images: Array<{ fileUrl: string; caption?: string | null }>,
  uploadedById: string,
) {
  const limited = images.slice(0, MAX_IMAGES_PER_AREA);
  const created = [];

  for (let i = 0; i < limited.length; i += 1) {
    const img = limited[i];
    if (!img.fileUrl) continue;

    try {
      const idx = img.fileUrl.indexOf(`${BUCKET_NAME}/`);
      const sourcePath =
        idx >= 0 ? img.fileUrl.slice(idx + BUCKET_NAME.length + 1) : null;
      if (!sourcePath) continue;

      const { data: downloaded, error: downloadError } =
        await supabaseAdmin.storage.from(BUCKET_NAME).download(sourcePath);
      if (downloadError || !downloaded) {
        console.error("Failed to download image to copy", downloadError);
        continue;
      }

      const buffer = Buffer.from(await downloaded.arrayBuffer());
      const contentType = downloaded.type || "image/png";
      const ext = sourcePath.split(".").pop() || "png";
      const filePath = `areas/${areaId}/${Date.now()}-${i}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, { contentType, upsert: false });
      if (uploadError) {
        console.error("Failed to upload copied image", uploadError);
        continue;
      }

      const { data: urlData } = supabaseAdmin.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      const record = await prismaAny.fabricationOrderImage.create({
        data: {
          areaId,
          fileUrl: urlData.publicUrl,
          caption: img.caption || null,
          uploadedById,
        },
      });
      created.push(record);
    } catch (err) {
      // Best-effort: skip this image rather than failing the whole save.
      console.error("Failed to copy fabrication order image", err);
    }
  }

  return created;
}

export async function deleteOrderAreaImages(imageIds: string[]) {
  if (imageIds.length === 0) return;
  const images = await prismaAny.fabricationOrderImage.findMany({
    where: { id: { in: imageIds } },
  });

  await prismaAny.fabricationOrderImage.deleteMany({
    where: { id: { in: imageIds } },
  });

  const paths = images
    .map((img: any) => {
      const idx = img.fileUrl.indexOf(`${BUCKET_NAME}/`);
      return idx >= 0 ? img.fileUrl.slice(idx + BUCKET_NAME.length + 1) : null;
    })
    .filter(Boolean) as string[];

  if (paths.length > 0) {
    await supabaseAdmin.storage.from(BUCKET_NAME).remove(paths);
  }
}

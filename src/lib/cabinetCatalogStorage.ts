/**
 * Shared Supabase Storage helpers for vendor catalog PDFs and the per-item
 * reference images cropped from them (see cabinetCatalogVisuals.ts). One
 * bucket, two kinds of object: "vendors/<vendorId>/catalog-<ts>.<ext>" for
 * the uploaded PDF itself, "vendors/<vendorId>/items/<code>-<ts>.png" for a
 * cropped item image. Mirrors the pattern already used for sink images
 * (src/app/api/sinks/admin/sink-image-upload/route.ts) - same bucket/
 * public-URL/remove-by-path shape, just factored out since this feature
 * needs it from more than one route.
 */

import { supabaseAdmin } from "./supabase/server";

export const CABINET_CATALOG_BUCKET =
  process.env.SUPABASE_CABINET_CATALOG_BUCKET || "cabinet-catalogs";

let bucketEnsured = false;

/**
 * Best-effort bucket creation so this feature works out of the box even if
 * nobody has created the "cabinet-catalogs" bucket in the Supabase
 * dashboard yet - mirrors nothing existing (the sinks/fabrication buckets
 * were created manually), but costs nothing to attempt once per server
 * instance and keeps first-use from failing on a missing-bucket error.
 * Silently no-ops if it already exists or the service role can't create
 * buckets (e.g. a stricter Supabase plan) - upload itself will surface a
 * real error in that case.
 */
// Round 13 follow-up: a real vendor catalog can be 100MB+ (80+ pages of
// full-color photos). This only raises THIS bucket's own ceiling - if the
// project's overall Supabase plan caps uploads lower than this, that cap
// (Supabase dashboard -> Storage -> Settings) still wins and would need
// raising there separately.
const CATALOG_BUCKET_FILE_SIZE_LIMIT = "200mb";

async function ensureBucket() {
  if (bucketEnsured) return;
  bucketEnsured = true;
  try {
    const created = await supabaseAdmin.storage.createBucket(CABINET_CATALOG_BUCKET, {
      public: true,
      fileSizeLimit: CATALOG_BUCKET_FILE_SIZE_LIMIT,
    });
    if (created.error) {
      // Most likely "already exists" (e.g. the bucket was created by hand
      // in the Supabase dashboard, or by an earlier version of this
      // feature before fileSizeLimit was set) - make sure its size limit
      // is actually raised rather than leaving whatever it defaulted to.
      // Logged (not thrown) either way: if THIS also fails, the bucket
      // may genuinely not exist and need creating by hand in the
      // Supabase dashboard (Storage -> New bucket -> "cabinet-catalogs",
      // Public on) - the actual upload call below will then surface a
      // clear "bucket not found"-style error instead of failing silently.
      const updated = await supabaseAdmin.storage.updateBucket(CABINET_CATALOG_BUCKET, {
        public: true,
        fileSizeLimit: CATALOG_BUCKET_FILE_SIZE_LIMIT,
      });
      if (updated.error) {
        console.error(
          `cabinetCatalogStorage: couldn't create OR update the "${CABINET_CATALOG_BUCKET}" bucket ` +
            `(create: ${created.error.message}; update: ${updated.error.message}). If it doesn't ` +
            `exist yet, create it by hand in the Supabase dashboard: Storage -> New bucket -> name ` +
            `"${CABINET_CATALOG_BUCKET}" -> Public bucket: on.`,
        );
      }
    }
  } catch (err: any) {
    console.error("cabinetCatalogStorage: ensureBucket threw unexpectedly:", err?.message || err);
  }
}

export async function uploadCabinetCatalogFile(
  storagePath: string,
  data: ArrayBuffer | Buffer,
  contentType: string,
): Promise<string> {
  await ensureBucket();
  const uploadResult = await supabaseAdmin.storage
    .from(CABINET_CATALOG_BUCKET)
    .upload(storagePath, data, { contentType, upsert: true });
  if (uploadResult.error) {
    throw new Error(`Supabase upload failed: ${uploadResult.error.message}`);
  }
  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(CABINET_CATALOG_BUCKET).getPublicUrl(storagePath);
  if (!publicUrl) {
    throw new Error("Failed to resolve uploaded file URL");
  }
  return publicUrl;
}

export function extractCabinetCatalogStoragePath(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const marker = `${CABINET_CATALOG_BUCKET}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return null;
  return url.slice(markerIndex + marker.length);
}

export async function removeCabinetCatalogFile(url: string | null | undefined) {
  const path = extractCabinetCatalogStoragePath(url);
  if (!path) return;
  try {
    await supabaseAdmin.storage.from(CABINET_CATALOG_BUCKET).remove([path]);
  } catch {
    // Non-fatal - an orphaned old file in storage is harmless clutter,
    // never worth failing the caller's actual operation over.
  }
}

function slugifyCode(code: string): string {
  return (
    code
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

export async function uploadCabinetCatalogPdf(
  vendorId: string,
  fileName: string,
  data: ArrayBuffer,
): Promise<{ url: string; storagePath: string }> {
  const ext = (fileName.split(".").pop() || "pdf").toLowerCase();
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `vendors/${vendorId}/catalog-${unique}.${ext}`;
  const url = await uploadCabinetCatalogFile(storagePath, data, "application/pdf");
  return { url, storagePath };
}

function catalogPdfStoragePath(vendorId: string, fileName: string): string {
  const ext = (fileName.split(".").pop() || "pdf").toLowerCase();
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `vendors/${vendorId}/catalog-${unique}.${ext}`;
}

/**
 * Round 13 follow-up: a vendor catalog can be well past Vercel's request-
 * body size limit for a normal serverless function - uploading it through
 * our own API route (uploadCabinetCatalogPdf above) only works for small
 * files. For anything bigger, the browser instead uploads STRAIGHT to
 * Supabase Storage using a short-lived signed upload URL (never touching
 * our server's body-size limit at all), and only then tells our server
 * the resulting path so it can be saved against the vendor - see
 * .../catalog/sign-upload/route.ts and ImportClient.tsx's uploadCatalogPdf.
 */
export async function createCabinetCatalogPdfUploadTarget(
  vendorId: string,
  fileName: string,
): Promise<{ bucket: string; path: string; signedUrl: string; token: string }> {
  await ensureBucket();
  const path = catalogPdfStoragePath(vendorId, fileName);
  const result = await supabaseAdmin.storage
    .from(CABINET_CATALOG_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (result.error) {
    throw new Error(`Could not prepare upload: ${result.error.message}`);
  }
  return {
    bucket: CABINET_CATALOG_BUCKET,
    path: result.data.path,
    signedUrl: result.data.signedUrl,
    token: result.data.token,
  };
}

/** Resolves a storage path (already uploaded, e.g. via the signed-upload
 * flow above) to its public URL - same bucket, no fetch/round-trip needed
 * since the bucket is public. */
export function resolveCabinetCatalogPublicUrl(storagePath: string): string {
  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(CABINET_CATALOG_BUCKET).getPublicUrl(storagePath);
  return publicUrl;
}

export async function uploadCabinetCatalogItemImage(
  vendorId: string,
  primaryCode: string,
  png: Buffer,
): Promise<string> {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `vendors/${vendorId}/items/${slugifyCode(primaryCode)}-${unique}.png`;
  return uploadCabinetCatalogFile(storagePath, png, "image/png");
}

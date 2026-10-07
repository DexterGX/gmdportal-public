/**
 * Temporary storage for uploaded slab price-list files (PDF / Excel / CSV).
 *
 * Vendor price-list PDFs can easily be larger than Vercel's ~4.5MB
 * serverless request-body limit, so - same pattern as the cabinet catalog
 * PDF upload (see cabinetCatalogStorage.ts) - the browser uploads the file
 * straight to Supabase Storage with a short-lived signed URL, then every
 * import route (analyze / extract) downloads it from there by path.
 *
 * The bucket is PRIVATE (vendor pricing isn't public) - only the server's
 * service-role client reads it back. Files are removed after a successful
 * apply; anything left behind by an abandoned import is harmless clutter.
 */

import { supabaseAdmin } from "./supabase/server";
import { fileExtension } from "./slabsTemplate";

export const SLAB_IMPORT_BUCKET =
  process.env.SUPABASE_SLAB_IMPORT_BUCKET || "slab-price-list-imports";

const BUCKET_FILE_SIZE_LIMIT = "100mb";
const ALLOWED_EXTENSIONS = ["pdf", "xlsx", "xls", "csv"];

let bucketEnsured = false;

async function ensureBucket() {
  if (bucketEnsured) return;
  bucketEnsured = true;
  try {
    const created = await supabaseAdmin.storage.createBucket(SLAB_IMPORT_BUCKET, {
      public: false,
      fileSizeLimit: BUCKET_FILE_SIZE_LIMIT,
    });
    if (created.error) {
      // Most likely "already exists" - make sure the size limit is raised.
      const updated = await supabaseAdmin.storage.updateBucket(SLAB_IMPORT_BUCKET, {
        public: false,
        fileSizeLimit: BUCKET_FILE_SIZE_LIMIT,
      });
      if (updated.error) {
        console.error(
          `slabsImportStorage: couldn't create OR update bucket "${SLAB_IMPORT_BUCKET}" ` +
            `(create: ${created.error.message}; update: ${updated.error.message}). If it doesn't ` +
            `exist, create it in Supabase: Storage -> New bucket -> "${SLAB_IMPORT_BUCKET}" (private).`,
        );
      }
    }
  } catch (err: any) {
    console.error("slabsImportStorage: ensureBucket threw:", err?.message || err);
  }
}

export function isSupportedImportFile(fileName: string): boolean {
  return ALLOWED_EXTENSIONS.includes(fileExtension(fileName));
}

export async function createSlabImportUploadTarget(
  brandId: string,
  fileName: string,
): Promise<{ bucket: string; path: string; token: string }> {
  await ensureBucket();
  const ext = fileExtension(fileName);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const safeBrand = brandId.replace(/[^a-zA-Z0-9_-]/g, "");
  const path = `imports/${safeBrand}/${unique}.${ext}`;
  const result = await supabaseAdmin.storage
    .from(SLAB_IMPORT_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (result.error) {
    throw new Error(`Could not prepare upload: ${result.error.message}`);
  }
  return { bucket: SLAB_IMPORT_BUCKET, path: result.data.path, token: result.data.token };
}

/** Only paths this feature created are readable through the import routes. */
export function isValidImportPath(path: unknown, brandId: string): path is string {
  if (typeof path !== "string") return false;
  const safeBrand = brandId.replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    path.startsWith(`imports/${safeBrand}/`) &&
    !path.includes("..") &&
    isSupportedImportFile(path)
  );
}

export async function downloadSlabImportFile(path: string): Promise<ArrayBuffer> {
  const { data, error } = await supabaseAdmin.storage.from(SLAB_IMPORT_BUCKET).download(path);
  if (error || !data) {
    throw new Error(
      `Could not read the uploaded file from storage${error?.message ? `: ${error.message}` : ""}`,
    );
  }
  return data.arrayBuffer();
}

export async function removeSlabImportFile(path: string | null | undefined) {
  if (!path) return;
  try {
    await supabaseAdmin.storage.from(SLAB_IMPORT_BUCKET).remove([path]);
  } catch {
    // Non-fatal clutter.
  }
}

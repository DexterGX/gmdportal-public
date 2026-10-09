/**
 * Temporary private storage for cabinet price-list PDFs being imported.
 * Same pattern as slabsImportStorage.ts: the browser uploads straight to
 * Supabase Storage with a short-lived signed URL (price-list PDFs can exceed
 * Vercel's request-body limit), then the import routes download it by path.
 * The bucket is private; leftovers from abandoned imports are harmless.
 */

import { supabaseAdmin } from "./supabase/server";

export const CABINET_IMPORT_BUCKET =
  process.env.SUPABASE_CABINET_IMPORT_BUCKET || "cabinet-price-list-imports";

const BUCKET_FILE_SIZE_LIMIT = "100mb";
let bucketEnsured = false;

async function ensureBucket() {
  if (bucketEnsured) return;
  bucketEnsured = true;
  try {
    const created = await supabaseAdmin.storage.createBucket(CABINET_IMPORT_BUCKET, {
      public: false,
      fileSizeLimit: BUCKET_FILE_SIZE_LIMIT,
    });
    if (created.error) {
      const updated = await supabaseAdmin.storage.updateBucket(CABINET_IMPORT_BUCKET, {
        public: false,
        fileSizeLimit: BUCKET_FILE_SIZE_LIMIT,
      });
      if (updated.error) {
        console.error(
          `cabinetImportStorage: couldn't create OR update bucket "${CABINET_IMPORT_BUCKET}" ` +
            `(create: ${created.error.message}; update: ${updated.error.message}). If it doesn't ` +
            `exist, create it in Supabase: Storage -> New bucket -> "${CABINET_IMPORT_BUCKET}" (private).`,
        );
      }
    }
  } catch (err: any) {
    console.error("cabinetImportStorage: ensureBucket threw:", err?.message || err);
  }
}

export async function createCabinetImportUploadTarget(
  userId: string,
): Promise<{ bucket: string; path: string; token: string }> {
  await ensureBucket();
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  const path = `imports/${safeUser}/${unique}.pdf`;
  const result = await supabaseAdmin.storage
    .from(CABINET_IMPORT_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (result.error) {
    throw new Error(`Could not prepare upload: ${result.error.message}`);
  }
  return { bucket: CABINET_IMPORT_BUCKET, path: result.data.path, token: result.data.token };
}

/** Only paths this feature created for this admin are readable. */
export function isValidCabinetImportPath(path: unknown, userId: string): path is string {
  if (typeof path !== "string") return false;
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    path.startsWith(`imports/${safeUser}/`) && !path.includes("..") && path.endsWith(".pdf")
  );
}

export async function downloadCabinetImportFile(path: string): Promise<ArrayBuffer> {
  const { data, error } = await supabaseAdmin.storage.from(CABINET_IMPORT_BUCKET).download(path);
  if (error || !data) {
    throw new Error(
      `Could not read the uploaded file from storage${error?.message ? `: ${error.message}` : ""}`,
    );
  }
  return data.arrayBuffer();
}

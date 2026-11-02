/**
 * Helpers for matching cabinet item codes across vendors.
 *
 * Different companies write the same code differently: B9 vs B09, W3030 vs
 * W30-30, "B 12" vs "B12". `normalizeCabinetCode` collapses those so the same
 * cabinet can be found in another brand's catalog.
 */

/** Upper-case, drop spaces/dashes/dots/underscores/slashes, strip leading zeros in every number. */
export function normalizeCabinetCode(code: string): string {
  return String(code || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/\d+/g, (digits) => digits.replace(/^0+(?=\d)/, ""));
}

/**
 * Spellings worth searching for when someone types `text` - the text itself,
 * the version without leading zeros (B09 -> B9) and the version with single
 * digits padded to two (B9 -> B09).
 */
export function cabinetCodeSearchVariants(text: string): string[] {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const stripped = raw.replace(/\d+/g, (d) => d.replace(/^0+(?=\d)/, ""));
  const padded = stripped.replace(/\d+/g, (d) =>
    d.length === 1 ? `0${d}` : d,
  );
  return Array.from(new Set([raw, stripped, padded])).filter(Boolean);
}

/**
 * Finds, for each wanted code, the catalog item with the same code. An exact
 * (case-insensitive) match wins over a normalized one. Returns a Map keyed by
 * the wanted code exactly as it was passed in.
 */
export function matchCodesToCatalog<T extends { code: string }>(
  wantedCodes: string[],
  catalog: T[],
): Map<string, T> {
  const exact = new Map<string, T>();
  const normalized = new Map<string, T>();
  for (const item of catalog) {
    const exactKey = String(item.code || "").trim().toUpperCase();
    if (exactKey && !exact.has(exactKey)) exact.set(exactKey, item);
    const normKey = normalizeCabinetCode(item.code);
    if (normKey && !normalized.has(normKey)) normalized.set(normKey, item);
  }
  const result = new Map<string, T>();
  for (const wanted of wantedCodes) {
    const hit =
      exact.get(String(wanted || "").trim().toUpperCase()) ||
      normalized.get(normalizeCabinetCode(wanted));
    if (hit) result.set(wanted, hit);
  }
  return result;
}

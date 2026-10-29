"use client";

export type CabinetSummaryBucket = "STANDARD" | "DOUBLE" | "CUSTOM" | "MISC";

export const BUCKETS: CabinetSummaryBucket[] = ["STANDARD", "DOUBLE", "CUSTOM", "MISC"];

/** Fixed pixel widths for the New/Changed review tables' columns. Applied
 * via inline style (not just a Tailwind width class) so they can't be
 * squeezed by the table's own layout algorithm on resize/scroll - see the
 * comment above COL_W's first use. */
export const COL_W = {
  code: 160,
  description: 300,
  category: 160,
  bucket: 128,
  installationItem: 220,
  tier: 96,
  changedFields: 192,
};

// overflow: hidden on every cell (fixed and sticky) is what actually stops
// a neighbor's content from ever visually bleeding past its own column - a
// native <select>/number-input can render a sliver outside its cell's
// declared box, and a sticky cell's z-index only controls paint ORDER, not
// whether that sliver is clipped in the first place.
export function fixedColStyle(width: number) {
  return { width, minWidth: width, maxWidth: width, overflow: "hidden" as const };
}

export function stickyColStyle(width: number, left: number, edge = false) {
  return {
    width,
    minWidth: width,
    maxWidth: width,
    overflow: "hidden" as const,
    position: "sticky" as const,
    left,
    zIndex: 10,
    // Chrome can leave stale pixels ("ghosting") at the boundary of a
    // sticky cell when a wide, many-column fixed-layout table scrolls
    // underneath it - promoting the cell to its own compositing layer
    // forces a clean repaint of that boundary instead of a partial one.
    transform: "translateZ(0)" as const,
    willChange: "transform",
    // A soft shadow on the last sticky column's right edge makes the
    // frozen/scrolling boundary visually obvious and doubles as cover for
    // any stray sub-pixel seam at that edge.
    ...(edge ? { boxShadow: "4px 0 6px -4px rgba(0,0,0,0.25)" } : {}),
  };
}

export type ParsePlan = {
  sheetName: string;
  dataStartRow: number;
  codeCol: number;
  descriptionCol: number;
  sizeCol: number | null;
  priceColumns: { col: number; tierName: string }[];
  categoryMode: "column" | "sectionRow" | "none";
  categoryColumn: number | null;
  sectionDetectColumn: number | null;
  categoryBucketHints: { categoryContains: string; bucket: CabinetSummaryBucket }[];
  defaultBucket: CabinetSummaryBucket;
};

export type NormalizedItem = {
  key: string;
  code: string;
  description: string;
  category: string | null;
  summaryBucket: CabinetSummaryBucket;
  // Round 11: which row of the Installers Price Table prices this item's
  // installation - AI-assigned via installationItemHints, admin-correctable
  // right here. Null (unassigned) is normal and expected, not an error -
  // there is deliberately no forced default.
  installationItemId: string | null;
  // Round 12 follow-up #3: true when the AI assigned installationItemId
  // but wasn't fully confident - shown as a "double-check this" highlight
  // rather than trusted silently. Always false when unassigned (that gets
  // its own, stronger "needs attention" highlight instead).
  installationItemUncertain: boolean;
  prices: { tierName: string; price: number }[];
  sourceRow: number;
};

export type ExistingItem = {
  id: string;
  code: string;
  description: string;
  category: string | null;
  summaryBucket: CabinetSummaryBucket;
  installationItemId: string | null;
  isActive: boolean;
  prices: { tierId: string; price: number; tier: { id: string; name: string } }[];
};

export type InstallationItemOption = {
  id: string;
  code: string | null;
  description: string;
};

export type Diff = {
  newItems: NormalizedItem[];
  changedItems: { existing: ExistingItem; incoming: NormalizedItem; changes: string[] }[];
  discontinuedItems: ExistingItem[];
};

export type Vendor = {
  id: string;
  name: string;
  displayName: string;
  providerId: string | null;
  discount: number | null;
  factor: number | null;
  // Round 13: optional reference catalog PDF attached to this vendor - see
  // the schema comment on CabinetVendor.catalogPdfUrl. Used for better AI
  // classification hints during import and for "Extract item images".
  catalogPdfUrl: string | null;
  catalogPdfFileName: string | null;
  catalogUploadedAt: string | null;
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

/** Small inline-editable table cell shared by the New/Changed tabs. */
export function EditableText({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={value}
      className={`truncate rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 ${className || "w-full"}`}
    />
  );
}

export function BucketSelect({
  value,
  onChange,
}: {
  value: CabinetSummaryBucket;
  onChange: (value: CabinetSummaryBucket) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as CabinetSummaryBucket)}
      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
    >
      {BUCKETS.map((b) => (
        <option key={b} value={b}>
          {b}
        </option>
      ))}
    </select>
  );
}

/** Which row of GMD's real Installers Price Table prices this item's
 * installation - unlike Bucket, "Unassigned" is a normal, expected value
 * (no forced default), so it's always offered as an explicit option.
 *
 * Round 12 follow-up #3: two distinct highlight states so a reviewer can
 * scan the table instead of reading every row. Unassigned gets a hard
 * (red) highlight - nothing is priced yet, this needs a decision. A row
 * that IS assigned but came from a hint the AI itself marked low
 * confidence gets a lighter "doubt" (amber) highlight - probably right,
 * worth a second look before trusting it on a real estimate. A confident
 * match (AI-certain hint, or the deterministic bucket default) gets no
 * highlight at all. */
export function InstallationItemSelect({
  value,
  uncertain,
  options,
  onChange,
}: {
  value: string | null;
  uncertain?: boolean;
  options: InstallationItemOption[];
  onChange: (value: string | null) => void;
}) {
  const isUnassigned = !value;
  const stateClass = isUnassigned
    ? "border-red-400 bg-red-50 dark:border-red-500 dark:bg-red-950/40"
    : uncertain
      ? "border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/30"
      : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900";
  const title = isUnassigned
    ? "No installation item assigned - pick one"
    : uncertain
      ? "The AI wasn't fully sure about this match - double-check it"
      : undefined;
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
      title={title}
      className={`w-full rounded border px-2 py-1 text-xs text-gray-900 outline-none dark:text-gray-100 ${stateClass}`}
    >
      <option value="">-- Unassigned --</option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.description}
        </option>
      ))}
    </select>
  );
}

export type ChangedEntry = { existing: ExistingItem; incoming: NormalizedItem; changes: string[] };

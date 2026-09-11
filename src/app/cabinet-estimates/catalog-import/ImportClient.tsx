"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

type CabinetSummaryBucket = "STANDARD" | "DOUBLE" | "CUSTOM" | "MISC";

const BUCKETS: CabinetSummaryBucket[] = ["STANDARD", "DOUBLE", "CUSTOM", "MISC"];

/** Fixed pixel widths for the New/Changed review tables' columns. Applied
 * via inline style (not just a Tailwind width class) so they can't be
 * squeezed by the table's own layout algorithm on resize/scroll - see the
 * comment above COL_W's first use. */
const COL_W = {
  code: 160,
  description: 300,
  category: 160,
  bucket: 128,
  installationItem: 220,
  tier: 96,
  changedFields: 192,
};

function fixedColStyle(width: number) {
  return { width, minWidth: width, maxWidth: width };
}

function stickyColStyle(width: number, left: number) {
  return { width, minWidth: width, maxWidth: width, position: "sticky" as const, left, zIndex: 10 };
}

type ParsePlan = {
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

type NormalizedItem = {
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

type ExistingItem = {
  id: string;
  code: string;
  description: string;
  category: string | null;
  summaryBucket: CabinetSummaryBucket;
  installationItemId: string | null;
  isActive: boolean;
  prices: { tierId: string; price: number; tier: { id: string; name: string } }[];
};

type InstallationItemOption = {
  id: string;
  code: string | null;
  description: string;
};

type Diff = {
  newItems: NormalizedItem[];
  changedItems: { existing: ExistingItem; incoming: NormalizedItem; changes: string[] }[];
  discontinuedItems: ExistingItem[];
};

type Vendor = {
  id: string;
  name: string;
  displayName: string;
  providerId: string | null;
  discount: number | null;
  factor: number | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

/** Small inline-editable table cell shared by the New/Changed tabs. */
function EditableText({
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

function BucketSelect({
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
function InstallationItemSelect({
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

export default function ImportClient() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [useNewVendor, setUseNewVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState("");

  // Round 6: whether this file's prices are already at our cost, or retail
  // (in which case the selected vendor's company discount is applied at
  // preview time - see cabinetCatalogPricing.ts). Defaults to "net" so an
  // import behaves exactly as before unless an admin opts in.
  const [pricingMode, setPricingMode] = useState<"net" | "retail">("net");
  const [discountInput, setDiscountInput] = useState("0");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [resolvedVendorName, setResolvedVendorName] = useState("");
  const [parsePlan, setParsePlan] = useState<ParsePlan | null>(null);
  const [newItems, setNewItems] = useState<NormalizedItem[]>([]);
  const [changedItems, setChangedItems] = useState<
    { existing: ExistingItem; incoming: NormalizedItem; changes: string[] }[]
  >([]);
  const [discontinuedItems, setDiscontinuedItems] = useState<ExistingItem[]>([]);
  const [discontinuedSelected, setDiscontinuedSelected] = useState<Set<string>>(new Set());
  const [installationItems, setInstallationItems] = useState<InstallationItemOption[]>([]);
  const [activeTab, setActiveTab] = useState<"new" | "changed" | "discontinued">("new");

  useEffect(() => {
    async function loadVendors() {
      try {
        const res = await fetch("/api/cabinet-catalog/vendors");
        if (res.ok) {
          const data = await res.json();
          setVendors(data.vendors || []);
        }
      } catch {
        // non-fatal - vendor list just stays empty, "new vendor" still works
      }
    }
    loadVendors();
  }, []);

  // Pre-fill the discount from the selected vendor's linked company, if any -
  // still freely editable per Diego's ask ("let user mod it when uploading").
  useEffect(() => {
    const vendor = vendors.find((v) => v.id === vendorId);
    if (vendor && vendor.discount !== null) {
      setDiscountInput(String(vendor.discount));
    }
  }, [vendorId, vendors]);

  // Tier columns actually present, derived from the (post-split) item prices
  // rather than parsePlan.priceColumns - a grouped column like "CS, US" is
  // already split into two separate tiers by the time it reaches here.
  const tierNames = useMemo(() => {
    const seen: string[] = [];
    const add = (name: string) => {
      if (!seen.includes(name)) seen.push(name);
    };
    for (const item of newItems) for (const p of item.prices) add(p.tierName);
    for (const c of changedItems) for (const p of c.incoming.prices) add(p.tierName);
    return seen;
  }, [newItems, changedItems]);

  // Lets the admin rename a tier's raw header text (e.g. "CS") to its real
  // color name (e.g. "Cosmos") right here in the review screen - applied
  // when displaying and again when the import is applied.
  const [tierNameOverrides, setTierNameOverrides] = useState<Record<string, string>>({});
  function tierLabel(name: string) {
    return tierNameOverrides[name] ?? name;
  }

  const hasDiff = parsePlan !== null;

  function resetPreview() {
    setParsePlan(null);
    setNewItems([]);
    setChangedItems([]);
    setDiscontinuedItems([]);
    setDiscontinuedSelected(new Set());
    setWarnings([]);
  }

  async function runPreview(existingPlan?: ParsePlan) {
    if (!file) return;
    if (!useNewVendor && !vendorId) {
      setError("Select a vendor or choose to create a new one");
      return;
    }
    if (useNewVendor && !newVendorName.trim()) {
      setError("Enter a name for the new vendor");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (useNewVendor) {
        formData.append("newVendorName", newVendorName.trim());
      } else {
        formData.append("vendorId", vendorId);
      }
      if (existingPlan) {
        formData.append("parsePlan", JSON.stringify(existingPlan));
      }
      formData.append("pricingMode", pricingMode);
      formData.append("discount", pricingMode === "retail" ? discountInput : "0");

      const res = await fetch("/api/cabinet-catalog/admin/import/preview", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process file");
      }

      setResolvedVendorName(data.vendorName);
      setParsePlan(data.parsePlan);
      setInstallationItems(data.installationItems || []);
      setNewItems(data.diff.newItems);
      setChangedItems(data.diff.changedItems);
      setDiscontinuedItems(data.diff.discontinuedItems);
      setDiscontinuedSelected(
        new Set<string>(data.diff.discontinuedItems.map((i: ExistingItem) => i.id)),
      );
      setWarnings(data.warnings || []);
      setActiveTab("new");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleApply() {
    if (!parsePlan) return;
    if (
      !confirm(
        `Apply these changes to the ${resolvedVendorName} price list? This cannot be undone.`,
      )
    ) {
      return;
    }

    setIsApplying(true);
    setError(null);
    try {
      // Apply any header renames (e.g. "CS" -> "Cosmos") before sending -
      // the real CabinetPriceTier created/matched server-side should use
      // the human-readable name the admin chose here, not the raw column text.
      const remapPrices = (prices: NormalizedItem["prices"]) =>
        prices.map((p) => ({ ...p, tierName: tierNameOverrides[p.tierName] ?? p.tierName }));
      const remappedNewItems = newItems.map((item) => ({
        ...item,
        prices: remapPrices(item.prices),
      }));
      const remappedChangedItems = changedItems.map((c) => ({
        existingId: c.existing.id,
        incoming: { ...c.incoming, prices: remapPrices(c.incoming.prices) },
      }));

      const res = await fetch("/api/cabinet-catalog/admin/import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: useNewVendor ? null : vendorId,
          newVendorName: useNewVendor ? newVendorName.trim() : null,
          newItems: remappedNewItems,
          changedItems: remappedChangedItems,
          discontinuedIds: Array.from(discontinuedSelected),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to apply changes");
      }

      alert(
        `Import complete! Created: ${data.summary.created}, Updated: ${data.summary.updated}, Discontinued: ${data.summary.discontinued}`,
      );
      setFile(null);
      resetPreview();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsApplying(false);
    }
  }

  function updateNewItem(index: number, patch: Partial<NormalizedItem>) {
    setNewItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateNewItemPrice(index: number, tierName: string, price: number) {
    setNewItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, prices: item.prices.map((p) => (p.tierName === tierName ? { ...p, price } : p)) }
          : item,
      ),
    );
  }

  function updateChangedItem(index: number, patch: Partial<NormalizedItem>) {
    setChangedItems((prev) =>
      prev.map((c, i) => (i === index ? { ...c, incoming: { ...c.incoming, ...patch } } : c)),
    );
  }

  function updateChangedItemPrice(index: number, tierName: string, price: number) {
    setChangedItems((prev) =>
      prev.map((c, i) =>
        i === index
          ? {
              ...c,
              incoming: {
                ...c.incoming,
                prices: c.incoming.prices.map((p) => (p.tierName === tierName ? { ...p, price } : p)),
              },
            }
          : c,
      ),
    );
  }

  function toggleDiscontinued(id: string) {
    setDiscontinuedSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Import Cabinet Price List
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Upload a vendor&apos;s price list (any layout) and Claude will read its structure -
          codes, descriptions, price tiers, and categories - so you can review and confirm
          before anything is saved to the price list. Nothing is saved until you click Apply.
        </p>
      </div>

      {!hasDiff && (
        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Vendor <span className="text-red-500">*</span>
              </label>
              {!useNewVendor ? (
                <div className="flex items-center gap-2">
                  <select
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">-- Choose a vendor --</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.displayName}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setUseNewVendor(true)}
                    className="whitespace-nowrap px-3 py-2 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
                  >
                    + New vendor
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    placeholder="e.g. Eucucina"
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    onClick={() => {
                      setUseNewVendor(false);
                      setNewVendorName("");
                    }}
                    className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-600 hover:underline dark:text-gray-300"
                  >
                    Use existing
                  </button>
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Import only compares and updates items for this vendor.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Pricing
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="pricingMode"
                    checked={pricingMode === "net"}
                    onChange={() => setPricingMode("net")}
                  />
                  Prices already at our cost
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="pricingMode"
                    checked={pricingMode === "retail"}
                    onChange={() => setPricingMode("retail")}
                  />
                  Prices are retail / list price
                </label>
                {pricingMode === "retail" && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Discount</span>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      max="1"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      className="w-24 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {pricingMode === "retail"
                  ? "Discount is a fraction off retail (e.g. 0.3000 = 30% off) - applied to every price in this file before you review it. Pre-filled from this vendor's Cabinet Companies discount, if set."
                  : "No adjustment - prices in the file are used as our cost, same as today."}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Price list file
              </label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setError(null);
                }}
                className="block w-full cursor-pointer rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-900 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                CSV, XLS, or XLSX. Any layout - Claude figures out the columns.
              </p>
            </div>

            {file && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <FileSpreadsheet className="h-4 w-4" />
                <span>{file.name}</span>
                <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <AlertCircle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <button
              onClick={() => runPreview()}
              disabled={!file || isUploading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {isUploading ? "Reading with AI..." : "Upload & Analyze with AI"}
            </button>
          </div>
        </div>
      )}

      {hasDiff && parsePlan && (
        <div className="space-y-4">
          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Import Preview - {resolvedVendorName}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {newItems.length} new, {changedItems.length} updated,{" "}
                    {discontinuedItems.length} no longer in the file
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Read sheet &quot;{parsePlan.sheetName}&quot; - {tierNames.length} price
                    tier{tierNames.length === 1 ? "" : "s"}:{" "}
                    {tierNames.map((t) => tierLabel(t)).join(", ")}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => runPreview()}
                  disabled={isUploading}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  {isUploading ? "Re-reading..." : "Re-run AI"}
                </button>
                <button
                  onClick={() => {
                    resetPreview();
                    setFile(null);
                    setError(null);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  disabled={isApplying}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  {isApplying ? "Applying..." : "Apply to Price List"}
                </button>
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                <p className="mb-1 font-medium">{warnings.length} row(s) skipped:</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {warnings.slice(0, 10).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {warnings.length > 10 && <li>...and {warnings.length - 10} more</li>}
                </ul>
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}
          </div>

          <div className="rounded-lg bg-white shadow dark:bg-gray-800">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {(["new", "changed", "discontinued"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {tab} (
                  {tab === "new"
                    ? newItems.length
                    : tab === "changed"
                      ? changedItems.length
                      : discontinuedItems.length}
                  )
                </button>
              ))}
            </div>

            <div className="overflow-x-auto p-4">
              {activeTab === "new" && (
                <table className="text-left text-xs" style={{ tableLayout: "fixed" }}>
                  <thead>
                    <tr className="text-gray-500 dark:text-gray-400">
                      <th className="bg-white p-2 dark:bg-gray-800" style={stickyColStyle(COL_W.code, 0)}>Code</th>
                      <th
                        className="border-r border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800"
                        style={stickyColStyle(COL_W.description, COL_W.code)}
                      >
                        Description
                      </th>
                      <th className="p-2" style={fixedColStyle(COL_W.bucket)}>Bucket</th>
                      <th className="p-2" style={fixedColStyle(COL_W.installationItem)}>Installation Item</th>
                      {tierNames.map((tierName) => (
                        <th key={tierName} className="p-2" style={fixedColStyle(COL_W.tier)}>
                          <EditableText
                            value={tierLabel(tierName)}
                            onChange={(v) =>
                              setTierNameOverrides((prev) => ({ ...prev, [tierName]: v }))
                            }
                            className="w-full font-semibold"
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {newItems.map((item, i) => (
                      <tr key={item.key} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="bg-white p-2 dark:bg-gray-800" style={stickyColStyle(COL_W.code, 0)}>
                          <EditableText
                            value={item.code}
                            onChange={(v) => updateNewItem(i, { code: v })}
                          />
                        </td>
                        <td
                          className="border-r border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800"
                          style={stickyColStyle(COL_W.description, COL_W.code)}
                        >
                          <EditableText
                            value={item.description}
                            onChange={(v) => updateNewItem(i, { description: v })}
                          />
                        </td>
                        <td className="p-2" style={fixedColStyle(COL_W.bucket)}>
                          <BucketSelect
                            value={item.summaryBucket}
                            onChange={(v) => updateNewItem(i, { summaryBucket: v })}
                          />
                        </td>
                        <td className="p-2" style={fixedColStyle(COL_W.installationItem)}>
                          <InstallationItemSelect
                            value={item.installationItemId}
                            uncertain={item.installationItemUncertain}
                            options={installationItems}
                            onChange={(v) =>
                              updateNewItem(i, { installationItemId: v, installationItemUncertain: false })
                            }
                          />
                        </td>
                        {tierNames.map((tierName) => {
                          const price = item.prices.find((p) => p.tierName === tierName);
                          return (
                            <td key={tierName} className="p-2" style={fixedColStyle(COL_W.tier)}>
                              <input
                                type="number"
                                step="0.01"
                                value={price ? price.price : ""}
                                placeholder="N/A"
                                title={price ? undefined : "Not offered in this color/tier"}
                                onChange={(e) =>
                                  updateNewItemPrice(i, tierName, Number(e.target.value) || 0)
                                }
                                className="w-20 rounded border border-gray-300 bg-white px-2 py-1 text-right text-xs text-gray-900 outline-none placeholder:text-gray-400 placeholder:italic dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-600"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {newItems.length === 0 && (
                      <tr>
                        <td className="p-4 text-center text-gray-400" colSpan={4 + tierNames.length}>
                          No new items
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === "changed" && (
                <table className="text-left text-xs" style={{ tableLayout: "fixed" }}>
                  <thead>
                    <tr className="text-gray-500 dark:text-gray-400">
                      <th className="bg-white p-2 dark:bg-gray-800" style={stickyColStyle(COL_W.code, 0)}>Code</th>
                      <th
                        className="border-r border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800"
                        style={stickyColStyle(COL_W.description, COL_W.code)}
                      >
                        Description
                      </th>
                      <th className="p-2" style={fixedColStyle(COL_W.bucket)}>Bucket</th>
                      <th className="p-2" style={fixedColStyle(COL_W.installationItem)}>Installation Item</th>
                      <th className="p-2" style={fixedColStyle(COL_W.changedFields)}>Changed fields</th>
                      {tierNames.map((tierName) => (
                        <th key={tierName} className="p-2" style={fixedColStyle(COL_W.tier)}>
                          <EditableText
                            value={tierLabel(tierName)}
                            onChange={(v) =>
                              setTierNameOverrides((prev) => ({ ...prev, [tierName]: v }))
                            }
                            className="w-full font-semibold"
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {changedItems.map((c, i) => (
                      <tr key={c.existing.id} className="border-t border-gray-100 dark:border-gray-700">
                        <td
                          className="truncate bg-white p-2 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          style={stickyColStyle(COL_W.code, 0)}
                          title={c.incoming.code}
                        >
                          {c.incoming.code}
                        </td>
                        <td
                          className="border-r border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800"
                          style={stickyColStyle(COL_W.description, COL_W.code)}
                        >
                          <EditableText
                            value={c.incoming.description}
                            onChange={(v) => updateChangedItem(i, { description: v })}
                          />
                        </td>
                        <td className="p-2" style={fixedColStyle(COL_W.bucket)}>
                          <BucketSelect
                            value={c.incoming.summaryBucket}
                            onChange={(v) => updateChangedItem(i, { summaryBucket: v })}
                          />
                        </td>
                        <td className="p-2" style={fixedColStyle(COL_W.installationItem)}>
                          <InstallationItemSelect
                            value={c.incoming.installationItemId}
                            uncertain={c.incoming.installationItemUncertain}
                            options={installationItems}
                            onChange={(v) =>
                              updateChangedItem(i, { installationItemId: v, installationItemUncertain: false })
                            }
                          />
                        </td>
                        <td
                          className="p-2 text-amber-700 dark:text-amber-400"
                          style={fixedColStyle(COL_W.changedFields)}
                        >
                          {c.changes.join(", ")}
                        </td>
                        {tierNames.map((tierName) => {
                          const price = c.incoming.prices.find((p) => p.tierName === tierName);
                          const existingPrice = c.existing.prices.find(
                            (p) => p.tier.name === tierName,
                          );
                          return (
                            <td key={tierName} className="p-2" style={fixedColStyle(COL_W.tier)}>
                              <input
                                type="number"
                                step="0.01"
                                value={price ? price.price : ""}
                                placeholder="N/A"
                                onChange={(e) =>
                                  updateChangedItemPrice(i, tierName, Number(e.target.value) || 0)
                                }
                                title={
                                  price
                                    ? existingPrice
                                      ? `was ${formatCurrency(Number(existingPrice.price))}`
                                      : "new tier"
                                    : "Not offered in this color/tier"
                                }
                                className="w-20 rounded border border-gray-300 bg-white px-2 py-1 text-right text-xs text-gray-900 outline-none placeholder:text-gray-400 placeholder:italic dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-600"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {changedItems.length === 0 && (
                      <tr>
                        <td
                          className="p-4 text-center text-gray-400"
                          colSpan={5 + tierNames.length}
                        >
                          No changed items
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === "discontinued" && (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-500 dark:text-gray-400">
                      <th className="p-2">Mark inactive</th>
                      <th className="p-2">Code</th>
                      <th className="p-2">Description</th>
                      <th className="p-2">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discontinuedItems.map((item) => (
                      <tr key={item.id} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={discontinuedSelected.has(item.id)}
                            onChange={() => toggleDiscontinued(item.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                          />
                        </td>
                        <td className="p-2 text-gray-700 dark:text-gray-300">{item.code}</td>
                        <td className="p-2 text-gray-700 dark:text-gray-300">{item.description}</td>
                        <td className="p-2 text-gray-500 dark:text-gray-400">{item.category || "-"}</td>
                      </tr>
                    ))}
                    {discontinuedItems.length === 0 && (
                      <tr>
                        <td className="p-4 text-center text-gray-400" colSpan={4}>
                          Nothing missing from the file
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Columns read wrong? Correct the fields above before applying, or use &quot;Re-run
            AI&quot; to have Claude read the file again from scratch.
          </p>
        </div>
      )}
    </div>
  );
}

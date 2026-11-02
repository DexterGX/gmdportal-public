"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Printer, Search } from "lucide-react";
import PriceListEditor from "./PriceListEditor";
import LogVersionUpdateModal from "../LogVersionUpdateModal";

type Vendor = { id: string; name: string; displayName: string };

type PriceListItem = {
  id: string;
  code: string;
  description: string;
  category: string | null;
  summaryBucket: "STANDARD" | "DOUBLE" | "CUSTOM" | "MISC";
  installationItemId: string | null;
  isActive: boolean;
  updatedAt: string;
  prices: Record<string, number>;
};

type PriceListResponse = {
  vendor: {
    id: string;
    name: string;
    displayName: string;
    discount: number | null;
    factor: number | null;
    trueDiscount: number | null;
  };
  tiers: { id: string; name: string }[];
  installationItems: { id: string; code: string | null; description: string }[];
  lastUpdated: string | null;
  items: PriceListItem[];
};

/** Same inline-style fixed/sticky column pattern used on the Import review
 * tables (ImportClient.tsx) - a Tailwind width class alone was flaky under
 * `position: sticky` + horizontal scroll (see that file's history), so
 * Code/Description are pinned the same explicit way here. */
const COL_W = { code: 140, description: 320, category: 140, bucket: 110, installation: 200, tier: 100 };

function fixedColStyle(width: number) {
  return { width, minWidth: width, maxWidth: width };
}

function stickyColStyle(width: number, left: number) {
  return { width, minWidth: width, maxWidth: width, position: "sticky" as const, left, zIndex: 10 };
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatTimestamp(iso: string | null) {
  if (!iso) return "Never imported";
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function PriceListClient() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [data, setData] = useState<PriceListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loadedInactive, setLoadedInactive] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [versionPrompt, setVersionPrompt] = useState<{ vendorName: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/cabinet-catalog/vendors");
        const json = await res.json();
        if (res.ok) {
          setVendors(json.vendors || []);
          if (!vendorId && json.vendors?.length > 0) setVendorId(json.vendors[0].id);
        }
      } catch {
        // non-fatal - the vendor picker just stays empty
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  useEffect(() => {
    if (!vendorId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const params = new URLSearchParams({ vendorId });
        if (includeInactive) params.set("includeInactive", "1");
        const res = await fetch(`/api/cabinet-catalog/admin/price-list?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Failed to load the price list.");
          setData(null);
          return;
        }
        setData(json);
        setLoadedInactive(includeInactive);
      } catch {
        setError("Failed to load the price list.");
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [vendorId, includeInactive, reloadKey]);

  const installationLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of data?.installationItems || []) map.set(opt.id, opt.description);
    return map;
  }, [data]);

  function startEditing() {
    setMessage(null);
    setError(null);
    // Discontinued items are loaded too, so they can be fixed or brought back.
    if (!includeInactive) setIncludeInactive(true);
    setEditing(true);
  }

  const filteredItems = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.items;
    return data.items.filter(
      (item) =>
        item.code.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Price List</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            The prices on file for each cabinet company, and when that
            company&apos;s price list was last updated. Use Edit Price List to
            fix items, add or remove rows and price columns; Import Price List
            loads a whole new file.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/cabinet-estimates/catalog-import"
            className="whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Import Price List
          </Link>
          <Link
            href="/cabinet-estimates/companies"
            className="whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Cabinet Companies
          </Link>
          <button
            type="button"
            onClick={startEditing}
            disabled={!data || loading || editing}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:bg-gray-700 dark:text-blue-300 dark:hover:bg-gray-600"
          >
            <Pencil className="h-4 w-4" />
            Edit Price List
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!data || filteredItems.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            Company
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              disabled={editing}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              {vendors.length === 0 && <option value="">No companies yet</option>}
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.displayName}
                </option>
              ))}
            </select>
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, description, category..."
              className="rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={includeInactive}
              disabled={editing}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
            />
            Show discontinued items
          </label>
        </div>
        {data && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Last updated:{" "}
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {formatTimestamp(data.lastUpdated)}
            </span>
            {data.vendor.discount !== null && data.vendor.factor !== null && (
              <span className="ml-3">
                True Discount:{" "}
                <span className="font-medium">
                  {(((data.vendor.trueDiscount ?? data.vendor.discount) as number) * 100).toFixed(0)}%
                </span>
                {" · "}
                Applied Discount: <span className="font-medium">{(data.vendor.discount * 100).toFixed(0)}%</span>
                {" · "}
                Sales Multiplier: <span className="font-medium">{data.vendor.factor.toFixed(2)}x</span>
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          {message}
        </div>
      )}

      {editing && data && loadedInactive && (
        <PriceListEditor
          key={`${data.vendor.id}-${reloadKey}`}
          vendorId={data.vendor.id}
          vendorName={data.vendor.displayName}
          tiers={data.tiers}
          items={data.items}
          installationItems={data.installationItems || []}
          onSaved={(text) => {
            setEditing(false);
            setError(null);
            setMessage(text);
            setReloadKey((k) => k + 1);
            // Something actually changed - remind the admin to log a version.
            if (text !== "Price list saved.") setVersionPrompt({ vendorName: data.vendor.displayName });
          }}
          onCancel={() => setEditing(false)}
          onError={(text) => {
            setMessage(null);
            setError(text);
          }}
        />
      )}
      {editing && (!data || !loadedInactive) && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800">
          Loading the full price list...
        </div>
      )}

      <div className="hidden print:block">
        {data && (
          <div className="mb-3">
            <h2 className="text-xl font-bold">{data.vendor.displayName} - Price List</h2>
            <p className="text-sm text-gray-600">Last updated: {formatTimestamp(data.lastUpdated)}</p>
          </div>
        )}
      </div>

      <div
        className={`overflow-hidden rounded-xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800 print:overflow-visible print:rounded-none print:border-0 ${
          editing ? "hidden" : ""
        }`}
      >
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 text-left uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                <th
                  className="border border-gray-200 bg-gray-100 p-2 dark:border-gray-700 dark:bg-gray-700"
                  style={stickyColStyle(COL_W.code, 0)}
                >
                  Code
                </th>
                <th
                  className="border border-gray-200 bg-gray-100 p-2 dark:border-gray-700 dark:bg-gray-700"
                  style={stickyColStyle(COL_W.description, COL_W.code)}
                >
                  Description
                </th>
                <th className="border border-gray-200 p-2 dark:border-gray-700" style={fixedColStyle(COL_W.category)}>
                  Category
                </th>
                <th className="border border-gray-200 p-2 dark:border-gray-700" style={fixedColStyle(COL_W.bucket)}>
                  Bucket
                </th>
                <th className="border border-gray-200 p-2 dark:border-gray-700" style={fixedColStyle(COL_W.installation)}>
                  Installation
                </th>
                {(data?.tiers || []).map((tier) => (
                  <th
                    key={tier.id}
                    className="border border-gray-200 p-2 text-right dark:border-gray-700"
                    style={fixedColStyle(COL_W.tier)}
                  >
                    {tier.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5 + (data?.tiers.length || 0)} className="p-4 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5 + (data?.tiers.length || 0)} className="p-4 text-center text-gray-500">
                    {data
                      ? "No items match this vendor yet - import a price list to get started."
                      : "Pick a company above to browse its price list."}
                  </td>
                </tr>
              )}
              {!loading &&
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className={item.isActive ? "" : "opacity-50"}
                    title={item.isActive ? undefined : "Discontinued - no longer offered"}
                  >
                    <td
                      className="border border-gray-200 bg-white p-2 font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      style={stickyColStyle(COL_W.code, 0)}
                    >
                      {item.code}
                    </td>
                    <td
                      className="border border-gray-200 bg-white p-2 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      style={stickyColStyle(COL_W.description, COL_W.code)}
                    >
                      {item.description}
                    </td>
                    <td className="border border-gray-200 p-2 text-gray-600 dark:border-gray-700 dark:text-gray-400" style={fixedColStyle(COL_W.category)}>
                      {item.category || "-"}
                    </td>
                    <td className="border border-gray-200 p-2 text-gray-600 dark:border-gray-700 dark:text-gray-400" style={fixedColStyle(COL_W.bucket)}>
                      {item.summaryBucket}
                    </td>
                    <td className="border border-gray-200 p-2 text-gray-600 dark:border-gray-700 dark:text-gray-400" style={fixedColStyle(COL_W.installation)}>
                      {(item.installationItemId && installationLabel.get(item.installationItemId)) || (
                        <span className="italic text-gray-400 dark:text-gray-500">Unassigned</span>
                      )}
                    </td>
                    {(data?.tiers || []).map((tier) => (
                      <td
                        key={tier.id}
                        className="border border-gray-200 p-2 text-right text-gray-900 dark:border-gray-700 dark:text-gray-100"
                        style={fixedColStyle(COL_W.tier)}
                      >
                        {tier.id in item.prices ? (
                          formatCurrency(item.prices[tier.id])
                        ) : (
                          <span className="italic text-gray-400 dark:text-gray-500">N/A</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {versionPrompt && (
        <LogVersionUpdateModal
          title="Price list saved - log a version update?"
          defaultNote={`Updated ${versionPrompt.vendorName} price list`}
          onClose={(logged) => {
            setVersionPrompt(null);
            if (logged) setMessage((prev) => `${prev ? `${prev} ` : ""}Version updated to ${logged}.`);
          }}
        />
      )}
    </div>
  );
}

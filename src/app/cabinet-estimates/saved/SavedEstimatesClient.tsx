"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Printer,
  Archive,
  ArchiveRestore,
  Trash2,
  History,
  Search,
  X,
  Pencil,
} from "lucide-react";
import { formatCurrency } from "@/lib/cabinetEstimateCalc";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";

type EstimateRow = {
  id: string;
  estimateNumber: string | null;
  date: string;
  customerName: string;
  jobName: string | null;
  dealName: string | null;
  salesRep: string;
  brand: string | null;
  isActive: boolean;
  isRemeasure?: boolean;
  remeasureByName?: string | null;
  total: number;
  createdAt: string;
  createdBy: { name: string | null; email: string | null } | null;
};

type HistoryEntry = {
  id: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  changedByUser: { name: string | null; email: string | null } | null;
};

const DEFAULT_STATUS: "active" | "archived" | "all" = "active";

export default function SavedEstimatesClient({ isAdmin }: { isAdmin: boolean }) {
  const [estimates, setEstimates] = useState<EstimateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSalesReps, setSelectedSalesReps] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [status, setStatus] = useState<"active" | "archived" | "all">(DEFAULT_STATUS);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyEstimateId, setHistoryEstimateId] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function load(statusValue: "active" | "archived" | "all" = status) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("status", statusValue);
      const res = await fetch(`/api/cabinet-estimates?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load estimates");
      setEstimates(json);
    } catch (err: any) {
      setError(err?.message || "Failed to load estimates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const salesReps = useMemo(
    () => Array.from(new Set(estimates.map((e) => e.salesRep).filter(Boolean))).sort(),
    [estimates],
  );
  const brands = useMemo(
    () =>
      Array.from(
        new Set(estimates.map((e) => e.brand).filter((b): b is string => Boolean(b))),
      ).sort(),
    [estimates],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return estimates.filter((estimate) => {
      if (q) {
        const haystack = [
          estimate.estimateNumber,
          estimate.customerName,
          estimate.jobName,
          estimate.dealName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (
        selectedSalesReps.length > 0 &&
        !selectedSalesReps.includes(estimate.salesRep)
      ) {
        return false;
      }
      if (
        selectedBrands.length > 0 &&
        !(estimate.brand && selectedBrands.includes(estimate.brand))
      ) {
        return false;
      }
      return true;
    });
  }, [estimates, search, selectedSalesReps, selectedBrands]);

  const hasActiveFilters =
    search !== "" ||
    selectedSalesReps.length > 0 ||
    selectedBrands.length > 0 ||
    status !== DEFAULT_STATUS;

  function clearFilters() {
    setSearch("");
    setSelectedSalesReps([]);
    setSelectedBrands([]);
    setStatus(DEFAULT_STATUS);
  }

  async function toggleArchive(estimate: EstimateRow) {
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/cabinet-estimates/${estimate.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !estimate.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Action failed");
      setMessage(estimate.isActive ? "Estimate archived." : "Estimate restored.");
      await load();
    } catch (err: any) {
      setError(err?.message || "Action failed");
    }
  }

  async function permanentlyDelete(estimate: EstimateRow) {
    if (
      !confirm(
        `Permanently delete the estimate for "${estimate.customerName}"? This can't be undone.`,
      )
    )
      return;
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/cabinet-estimates/${estimate.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Delete failed");
      setMessage("Estimate deleted.");
      await load();
    } catch (err: any) {
      setError(err?.message || "Delete failed");
    }
  }

  async function openHistory(estimateId: string) {
    setHistoryEstimateId(estimateId);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/cabinet-estimates/${estimateId}/history`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load history");
      setHistoryEntries(json);
    } catch {
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Saved Estimates
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Search, review, and manage saved cabinet estimates.
        </p>
      </div>

      {(error || message) && (
        <div
          className={`rounded-md border p-3 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              : "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        {/* Search on top */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by estimate #, customer, or job..."
            className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>

        {/* Dropdown filters below */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FilterMultiSelect
            label="Sales Rep"
            options={salesReps}
            selected={selectedSalesReps}
            onChange={setSelectedSalesReps}
            fullWidth
            matchInputStyle
          />
          <FilterMultiSelect
            label="Brand"
            options={brands}
            selected={selectedBrands}
            onChange={setSelectedBrands}
            fullWidth
            matchInputStyle
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </div>

        {/* Showing X of Y + Clear, one line */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Showing {filtered.length} of {estimates.length}
          </span>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors ${
              hasActiveFilters
                ? "cursor-pointer border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                : "cursor-not-allowed border border-transparent text-gray-400 dark:text-gray-600"
            }`}
          >
            <X className="h-3.5 w-3.5" /> Clear Filters
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">
                Estimate #
              </th>
              <th className="w-56 border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">
                Customer
              </th>
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">
                Job/Deal
              </th>
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">
                Brand
              </th>
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">
                Sales Rep
              </th>
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">
                Date
              </th>
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">
                Total
              </th>
              <th className="px-4 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading estimates...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No estimates found for these filters.
                </td>
              </tr>
            ) : (
              filtered.map((estimate) => (
                <tr key={estimate.id} className="border-b border-gray-100 dark:border-gray-700/60">
                  <td className="border-r border-gray-100 px-4 py-2 text-center dark:border-gray-700/60">
                    <Link
                      href={`/cabinet-estimates?estimateId=${estimate.id}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {estimate.estimateNumber || estimate.id.slice(0, 8).toUpperCase()}
                    </Link>
                    {!estimate.isActive && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        Archived
                      </span>
                    )}
                  </td>
                  <td className="w-56 border-r border-gray-100 px-4 py-2 font-medium dark:border-gray-700/60">
                    {estimate.customerName}
                  </td>
                  <td className="border-r border-gray-100 px-4 py-2 text-gray-600 dark:border-gray-700/60 dark:text-gray-400">
                    {estimate.jobName || estimate.dealName || "-"}
                  </td>
                  <td className="border-r border-gray-100 px-4 py-2 text-center dark:border-gray-700/60">
                    {estimate.brand || "-"}
                  </td>
                  <td className="border-r border-gray-100 px-4 py-2 text-center dark:border-gray-700/60">
                    {estimate.salesRep || "-"}
                    {estimate.isRemeasure && estimate.remeasureByName ? (
                      <div className="mt-0.5 text-[10px] font-normal leading-tight text-gray-500 dark:text-gray-400">
                        Remeasure: {estimate.remeasureByName}
                      </div>
                    ) : null}
                  </td>
                  <td className="border-r border-gray-100 px-4 py-2 text-center dark:border-gray-700/60">
                    {new Date(estimate.date || estimate.createdAt).toLocaleDateString()}
                  </td>
                  <td className="border-r border-gray-100 px-4 py-2 text-center font-semibold dark:border-gray-700/60">
                    {formatCurrency(estimate.total)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-nowrap items-center justify-center gap-1">
                      <Link
                        href={`/cabinet-estimates/print/${estimate.id}?autoprint=1`}
                        target="_blank"
                        title="Print"
                        className="inline-flex items-center justify-center gap-0.5 rounded-md border border-gray-300 px-1.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <Printer className="h-3 w-3" /> Print
                      </Link>
                      <Link
                        href={`/cabinet-estimates?estimateId=${estimate.id}`}
                        title="Edit"
                        className="inline-flex items-center justify-center gap-0.5 rounded-md border border-blue-300 px-1.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => openHistory(estimate.id)}
                        title="Log"
                        className="inline-flex items-center justify-center gap-0.5 rounded-md border border-gray-300 px-1.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <History className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleArchive(estimate)}
                        title={estimate.isActive ? "Archive" : "Restore"}
                        className="inline-flex items-center justify-center gap-0.5 rounded-md border border-amber-300 px-1.5 py-1 text-[11px] font-medium text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/30"
                      >
                        {estimate.isActive ? (
                          <Archive className="h-3 w-3" />
                        ) : (
                          <ArchiveRestore className="h-3 w-3" />
                        )}
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => permanentlyDelete(estimate)}
                          title="Delete"
                          className="inline-flex items-center justify-center gap-0.5 rounded-md border border-red-300 px-1.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {historyEstimateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-4 dark:bg-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Estimate History
              </h2>
              <button
                type="button"
                onClick={() => setHistoryEstimateId(null)}
                className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {historyLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
            ) : historyEntries.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No history recorded yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-gray-500 dark:text-gray-400">
                    <th className="py-1 pr-2">Date</th>
                    <th className="py-1 pr-2">Action</th>
                    <th className="py-1 pr-2">By</th>
                  </tr>
                </thead>
                <tbody>
                  {historyEntries.map((h) => (
                    <tr key={h.id} className="border-t border-gray-100 dark:border-gray-700/60">
                      <td className="py-1 pr-2">{new Date(h.createdAt).toLocaleString()}</td>
                      <td className="py-1 pr-2">{h.action}</td>
                      <td className="py-1 pr-2">
                        {h.changedByUser?.name || h.changedByUser?.email || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

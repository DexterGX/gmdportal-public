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
import {
  describeEstimateAction,
  describeEstimateChangeParts,
  type ChangePart,
} from "@/lib/cabinetEstimateChanges";

type EstimateRow = {
  id: string;
  estimateNumber: string | null;
  date: string;
  customerName: string;
  jobName: string | null;
  dealName: string | null;
  salesRep: string;
  brand: string | null;
  groupColor?: string | null;
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
  estimateNumber?: string | null;
  changedByUser: { name: string | null; email: string | null } | null;
};

type HistoryEvent = {
  key: string;
  createdAt: string;
  estimateNumber: string | null;
  by: string;
  lines: ChangePart[][];
};

const ACTION_ORDER: Record<string, number> = { CREATED: 0, CHANGED: 1, UPDATED: 1, REVISED: 2 };

const TONE_CLASS: Record<ChangePart["tone"], string> = {
  add: "font-medium text-green-600 dark:text-green-400",
  remove: "font-medium text-red-600 dark:text-red-400",
  change: "font-medium text-blue-600 dark:text-blue-400",
  neutral: "",
};

/** Rows saved together (same estimate, same person, within seconds) become one event. */
function groupHistory(entries: HistoryEntry[]): HistoryEvent[] {
  type Raw = {
    key: string;
    createdAt: string;
    estimateNumber: string | null;
    by: string;
    time: number;
    rows: HistoryEntry[];
  };
  const raws: Raw[] = [];
  for (const entry of entries) {
    const time = new Date(entry.createdAt).getTime();
    const by = entry.changedByUser?.name || entry.changedByUser?.email || "-";
    const number = entry.estimateNumber || null;
    const event = raws.find(
      (e) =>
        e.estimateNumber === number &&
        e.by === by &&
        Math.abs(e.time - time) <= 5000 &&
        // the "edited in" note is its own event on the older estimate
        (e.rows[0].action === "REVISED") === (entry.action === "REVISED"),
    );
    if (event) {
      event.rows.push(entry);
    } else {
      raws.push({ key: entry.id, createdAt: entry.createdAt, estimateNumber: number, by, time, rows: [entry] });
    }
  }

  const sorted = (rows: HistoryEntry[]) =>
    [...rows].sort((a, b) => (ACTION_ORDER[a.action] ?? 3) - (ACTION_ORDER[b.action] ?? 3));
  const isDetail = (r: HistoryEntry) => r.action === "CHANGED" || r.action === "UPDATED";

  // One edit = one row. The older estimate's "edited in X" entry absorbs the
  // new estimate's creation entry (same save), so the changes show only once.
  const isReplaced = (r: HistoryEntry) =>
    (r.action === "REVISED" || r.action === "ARCHIVED") && r.fieldName === "replacedBy" && Boolean(r.newValue);
  const absorbed = new Set<string>();
  const nextOf = new Map<string, Raw>();
  for (const e of raws) {
    const replaced = e.rows.find(isReplaced);
    if (!replaced) continue;
    const next = raws.find(
      (o) =>
        !absorbed.has(o.key) &&
        o.estimateNumber === replaced.newValue &&
        o.rows.some((r) => r.action === "CREATED" && r.fieldName === "revisionOf"),
    );
    if (next) {
      absorbed.add(next.key);
      nextOf.set(e.key, next);
    }
  }

  return raws
    .filter((e) => !absorbed.has(e.key))
    .map((e) => {
      const rows = sorted(e.rows);
      const lines: ChangePart[][] = [];
      for (const r of rows) {
        const parts =
          describeEstimateChangeParts(r) ??
          (r.fieldName ? null : [{ text: describeEstimateAction(r.action), tone: "neutral" as const }]);
        if (parts) lines.push(parts);
      }
      const next = nextOf.get(e.key);
      if (next) {
        for (const r of sorted(next.rows).filter(isDetail)) {
          const parts = describeEstimateChangeParts(r);
          if (parts) lines.push(parts);
        }
      }
      if (lines.length === 0) lines.push([{ text: describeEstimateAction(rows[0].action), tone: "neutral" }]);
      return { key: e.key, createdAt: e.createdAt, estimateNumber: e.estimateNumber, by: e.by, lines };
    });
}

const DEFAULT_STATUS: "active" | "archived" | "all" = "active";

export default function SavedEstimatesClient({ isAdmin }: { isAdmin: boolean }) {
  const [estimates, setEstimates] = useState<EstimateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchNumber, setSearchNumber] = useState("");
  const [searchCustomer, setSearchCustomer] = useState("");
  const [searchJob, setSearchJob] = useState("");
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
    const qNumber = searchNumber.trim().toLowerCase();
    const qCustomer = searchCustomer.trim().toLowerCase();
    const qJob = searchJob.trim().toLowerCase();
    return estimates.filter((estimate) => {
      if (qNumber && !(estimate.estimateNumber || "").toLowerCase().includes(qNumber)) {
        return false;
      }
      if (qCustomer && !(estimate.customerName || "").toLowerCase().includes(qCustomer)) {
        return false;
      }
      if (qJob) {
        const jobText = [estimate.jobName, estimate.dealName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!jobText.includes(qJob)) return false;
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
  }, [estimates, searchNumber, searchCustomer, searchJob, selectedSalesReps, selectedBrands]);

  const hasActiveFilters =
    searchNumber !== "" ||
    searchCustomer !== "" ||
    searchJob !== "" ||
    selectedSalesReps.length > 0 ||
    selectedBrands.length > 0 ||
    status !== DEFAULT_STATUS;

  function clearFilters() {
    setSearchNumber("");
    setSearchCustomer("");
    setSearchJob("");
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

  const historyEvents = useMemo(() => groupHistory(historyEntries), [historyEntries]);

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
        {/* Searches on top: one box each for Estimate #, Customer and Job/Deal */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { value: searchNumber, set: setSearchNumber, placeholder: "Search Estimate #..." },
            { value: searchCustomer, set: setSearchCustomer, placeholder: "Search Customer..." },
            { value: searchJob, set: setSearchJob, placeholder: "Search Job/Deal..." },
          ].map((box) => (
            <div key={box.placeholder} className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={box.value}
                onChange={(e) => box.set(e.target.value)}
                placeholder={box.placeholder}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-900"
              />
            </div>
          ))}
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
                Brand/Color
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
                    <div className="font-medium">{estimate.brand || "-"}</div>
                    {estimate.groupColor ? (
                      <div className="mt-0.5 text-xs leading-tight text-gray-500 dark:text-gray-400">
                        {estimate.groupColor}
                      </div>
                    ) : null}
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
          <div className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-4 dark:bg-gray-800">
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
                    <th className="py-1 pr-2">Estimate #</th>
                    <th className="py-1 pr-2">What changed</th>
                    <th className="py-1 pr-2">By</th>
                  </tr>
                </thead>
                <tbody>
                  {historyEvents.map((h) => (
                    <tr key={h.key} className="border-t border-gray-100 align-top dark:border-gray-700/60">
                      <td className="py-1 pr-2">{new Date(h.createdAt).toLocaleString()}</td>
                      <td className="py-1 pr-2 font-medium">{h.estimateNumber || "-"}</td>
                      <td className="py-1 pr-2">
                        {h.lines.map((line, idx) => (
                          <div key={idx}>
                            {line.map((part, partIdx) => (
                              <span key={partIdx} className={TONE_CLASS[part.tone]}>
                                {part.text}
                              </span>
                            ))}
                          </div>
                        ))}
                      </td>
                      <td className="py-1 pr-2">{h.by}</td>
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

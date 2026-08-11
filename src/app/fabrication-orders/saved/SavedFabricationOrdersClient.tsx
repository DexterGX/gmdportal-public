"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Printer, Archive, ArchiveRestore, Trash2, History, Search, X } from "lucide-react";
import { formatCurrency } from "@/lib/fabricationCalc";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";

type OrderRow = {
  id: string;
  orderNumber: string | null;
  date: string;
  clientName: string;
  dealName: string | null;
  salesRep: string;
  isActive: boolean;
  total: number;
  createdAt: string;
  areas: { id: string; name: string; areaTotal: number }[];
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

export default function SavedFabricationOrdersClient({ isAdmin }: { isAdmin: boolean }) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [foSearch, setFoSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [areaSearch, setAreaSearch] = useState("");
  const [selectedSalesReps, setSelectedSalesReps] = useState<string[]>([]);
  const [status, setStatus] = useState<"active" | "archived" | "all">(DEFAULT_STATUS);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function load(statusValue: "active" | "archived" | "all" = status) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("status", statusValue);
      const res = await fetch(`/api/fabrication-orders?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load orders");
      setOrders(json);
    } catch (err: any) {
      setError(err?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const salesReps = useMemo(
    () => Array.from(new Set(orders.map((o) => o.salesRep).filter(Boolean))).sort(),
    [orders],
  );

  const filtered = useMemo(() => {
    const fo = foSearch.trim().toLowerCase();
    const client = clientSearch.trim().toLowerCase();
    const area = areaSearch.trim().toLowerCase();

    return orders.filter((order) => {
      if (fo) {
        const orderNum = (order.orderNumber || order.id.slice(0, 8)).toLowerCase();
        if (!orderNum.includes(fo)) return false;
      }
      if (client && !order.clientName.toLowerCase().includes(client)) return false;
      if (area && !order.areas.some((a) => a.name.toLowerCase().includes(area))) return false;
      if (selectedSalesReps.length > 0 && !selectedSalesReps.includes(order.salesRep)) {
        return false;
      }
      return true;
    });
  }, [orders, foSearch, clientSearch, areaSearch, selectedSalesReps]);

  const hasActiveFilters =
    foSearch !== "" ||
    clientSearch !== "" ||
    areaSearch !== "" ||
    selectedSalesReps.length > 0 ||
    status !== DEFAULT_STATUS;

  function clearFilters() {
    setFoSearch("");
    setClientSearch("");
    setAreaSearch("");
    setSelectedSalesReps([]);
    setStatus(DEFAULT_STATUS);
  }

  async function toggleArchive(order: OrderRow) {
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/fabrication-orders/${order.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !order.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Action failed");
      setMessage(order.isActive ? "Archived." : "Restored.");
      await load();
    } catch (err: any) {
      setError(err?.message || "Action failed");
    }
  }

  async function permanentlyDelete(order: OrderRow) {
    if (
      !confirm(
        `Permanently delete the fabrication order for "${order.clientName}"? This can't be undone.`,
      )
    )
      return;
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/fabrication-orders/${order.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Delete failed");
      setMessage("Deleted.");
      await load();
    } catch (err: any) {
      setError(err?.message || "Delete failed");
    }
  }

  async function openHistory(orderId: string) {
    setHistoryOrderId(orderId);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/fabrication-orders/${orderId}/history`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load history");
      setHistoryEntries(json);
    } catch (err: any) {
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function exportCsv() {
    const header = ["FO #", "Client", "Job/Deal", "Sales Rep", "Areas", "Total", "Status", "Date"];
    const rows = filtered.map((o) => [
      o.orderNumber || o.id.slice(0, 8).toUpperCase(),
      o.clientName,
      o.dealName || "",
      o.salesRep,
      o.areas.map((a) => a.name).join(" | "),
      String(o.total.toFixed(2)),
      o.isActive ? "Active" : "Archived",
      new Date(o.date || o.createdAt).toLocaleDateString(),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fabrication-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Saved Fabrication Orders</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Search, review, and manage saved fabrication orders.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
        >
          Export CSV
        </button>
      </div>

      {(error || message) && (
        <div
          className={`rounded-md border p-3 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={foSearch}
              onChange={(e) => setFoSearch(e.target.value)}
              placeholder="Search FO #..."
              className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Filter by client name"
              className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={areaSearch}
              onChange={(e) => setAreaSearch(e.target.value)}
              placeholder="Filter by area name"
              className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <FilterMultiSelect
            label="Sales Rep"
            options={salesReps}
            selected={selectedSalesReps}
            onChange={setSelectedSalesReps}
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
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Showing {filtered.length} of {orders.length}
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
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">FO #</th>
              <th className="w-64 border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">Client</th>
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">Job/Deal</th>
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">Areas</th>
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">Date</th>
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">Total</th>
              <th className="px-4 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading fabrication orders...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No fabrication orders found for these filters.
                </td>
              </tr>
            ) : (
              filtered.map((order) => (
                <tr key={order.id} className="border-b border-gray-100 dark:border-gray-700/60">
                  <td className="border-r border-gray-100 px-4 py-2 text-center dark:border-gray-700/60">
                    <Link
                      href={`/fabrication-orders?orderId=${order.id}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {order.orderNumber || order.id.slice(0, 8).toUpperCase()}
                    </Link>
                    {!order.isActive && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        Archived
                      </span>
                    )}
                  </td>
                  <td className="w-64 border-r border-gray-100 px-4 py-2 font-medium dark:border-gray-700/60">
                    {order.clientName}
                  </td>
                  <td className="border-r border-gray-100 px-4 py-2 text-gray-600 dark:border-gray-700/60 dark:text-gray-400">
                    {order.dealName || "-"}
                  </td>
                  <td className="border-r border-gray-100 px-4 py-2 text-center dark:border-gray-700/60">
                    {order.areas.map((a) => a.name).join(", ")}
                  </td>
                  <td className="border-r border-gray-100 px-4 py-2 text-center dark:border-gray-700/60">
                    {new Date(order.date || order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="border-r border-gray-100 px-4 py-2 text-center font-semibold dark:border-gray-700/60">
                    {formatCurrency(order.total)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-nowrap items-center justify-center gap-1">
                      <Link
                        href={`/fabrication-orders?orderId=${order.id}&autoprint=1`}
                        target="_blank"
                        title="Print"
                        className="inline-flex items-center justify-center gap-0.5 rounded-md border border-gray-300 px-1.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <Printer className="h-3 w-3" /> Print
                      </Link>
                      <Link
                        href={`/fabrication-orders?orderId=${order.id}`}
                        title="Edit"
                        className="inline-flex items-center justify-center gap-0.5 rounded-md border border-blue-300 px-1.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => openHistory(order.id)}
                        title="Log"
                        className="inline-flex items-center justify-center gap-0.5 rounded-md border border-gray-300 px-1.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <History className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleArchive(order)}
                        title={order.isActive ? "Archive" : "Restore"}
                        className="inline-flex items-center justify-center gap-0.5 rounded-md border border-amber-300 px-1.5 py-1 text-[11px] font-medium text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/30"
                      >
                        {order.isActive ? (
                          <Archive className="h-3 w-3" />
                        ) : (
                          <ArchiveRestore className="h-3 w-3" />
                        )}
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => permanentlyDelete(order)}
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

      {historyOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-4 dark:bg-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Order History
              </h2>
              <button
                type="button"
                onClick={() => setHistoryOrderId(null)}
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
                    <th className="py-1 pr-2">Field</th>
                    <th className="py-1 pr-2">Old</th>
                    <th className="py-1 pr-2">New</th>
                    <th className="py-1 pr-2">By</th>
                  </tr>
                </thead>
                <tbody>
                  {historyEntries.map((h) => (
                    <tr key={h.id} className="border-t border-gray-100 dark:border-gray-700/60">
                      <td className="py-1 pr-2">{new Date(h.createdAt).toLocaleString()}</td>
                      <td className="py-1 pr-2">{h.action}</td>
                      <td className="py-1 pr-2">{h.fieldName || "-"}</td>
                      <td className="py-1 pr-2">{h.oldValue ?? "-"}</td>
                      <td className="py-1 pr-2">{h.newValue ?? "-"}</td>
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

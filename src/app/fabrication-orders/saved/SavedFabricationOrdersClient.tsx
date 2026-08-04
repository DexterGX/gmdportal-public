"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Printer, Archive, ArchiveRestore, Trash2, History, Search, X } from "lucide-react";
import { formatCurrency } from "@/lib/fabricationCalc";

type OrderRow = {
  id: string;
  orderNumber: string | null;
  clientName: string;
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

export default function SavedFabricationOrdersClient({ isAdmin }: { isAdmin: boolean }) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [salesRepFilter, setSalesRepFilter] = useState("");
  const [status, setStatus] = useState<"active" | "archived" | "all">("active");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (salesRepFilter) params.set("salesRep", salesRepFilter);
      params.set("status", status);
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
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const salesReps = useMemo(
    () => Array.from(new Set(orders.map((o) => o.salesRep).filter(Boolean))).sort(),
    [orders],
  );

  function clearFilters() {
    setQ("");
    setSalesRepFilter("");
    setStatus("active");
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
    const header = ["Client", "Sales Rep", "Areas", "Total", "Status", "Created"];
    const rows = orders.map((o) => [
      o.clientName,
      o.salesRep,
      String(o.areas.length),
      String(o.total.toFixed(2)),
      o.isActive ? "Active" : "Archived",
      new Date(o.createdAt).toLocaleDateString(),
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

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Client or order #"
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Sales Rep
          </label>
          <select
            value={salesRepFilter}
            onChange={(e) => setSalesRepFilter(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          >
            <option value="">All</option>
            {salesReps.map((rep) => (
              <option key={rep} value={rep}>
                {rep}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
        >
          <X className="h-3.5 w-3.5" /> Clear Filters
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Sales Rep</th>
              <th className="px-4 py-3">Areas</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading fabrication orders...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No fabrication orders found for these filters.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b border-gray-100 dark:border-gray-700/60">
                  <td className="px-4 py-3 font-medium">{order.clientName}</td>
                  <td className="px-4 py-3">{order.salesRep}</td>
                  <td className="px-4 py-3">{order.areas.map((a) => a.name).join(", ")}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(order.total)}</td>
                  <td className="px-4 py-3">
                    {order.isActive ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        Archived
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/fabrication-orders?orderId=${order.id}`}
                      className="mr-3 text-blue-600 hover:underline"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/fabrication-orders/print/${order.id}`}
                      target="_blank"
                      className="mr-3 inline-flex items-center gap-1 text-gray-600 hover:underline dark:text-gray-300"
                    >
                      <Printer className="h-3.5 w-3.5" /> Print
                    </Link>
                    <button
                      type="button"
                      onClick={() => openHistory(order.id)}
                      className="mr-3 inline-flex items-center gap-1 text-gray-600 hover:underline dark:text-gray-300"
                    >
                      <History className="h-3.5 w-3.5" /> Log
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleArchive(order)}
                      className="mr-3 inline-flex items-center gap-1 text-amber-600 hover:underline"
                    >
                      {order.isActive ? (
                        <>
                          <Archive className="h-3.5 w-3.5" /> Archive
                        </>
                      ) : (
                        <>
                          <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                        </>
                      )}
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => permanentlyDelete(order)}
                        className="inline-flex items-center gap-1 text-red-600 hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
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

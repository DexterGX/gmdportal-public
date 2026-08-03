"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Check, X as XIcon, Package, ExternalLink } from "lucide-react";
import type { StoreRestockRequest } from "../types";
import { RESTOCK_STATUS_STYLES } from "../types";

function getPurchaseLink(request: StoreRestockRequest): string | null {
  const providers = request.item?.providers ?? [];
  const preferred = providers.find((p) => p.isPreferred && p.purchaseLink) ?? providers.find((p) => p.purchaseLink);
  return preferred?.purchaseLink ?? request.item?.purchaseLink ?? null;
}

const STATUS_TABS: { key: "" | StoreRestockRequest["status"]; label: string }[] = [
  { key: "", label: "All" },
  { key: "REQUESTED", label: "Requested" },
  { key: "ORDERED", label: "Ordered" },
  { key: "RECEIVED", label: "Received" },
  { key: "CANCELED", label: "Canceled" },
];

export default function RestockRequestsClient({ canAction }: { canAction: boolean }) {
  const [requests, setRequests] = useState<StoreRestockRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<"" | StoreRestockRequest["status"]>("REQUESTED");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const url = new URL("/api/store-inventory/restock-requests", window.location.origin);
      if (statusFilter) url.searchParams.set("status", statusFilter);
      const res = await fetch(url.toString());
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function handleAction(id: string, status: "ORDERED" | "RECEIVED" | "CANCELED") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/store-inventory/restock-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update request");
      }
      showToast("success", `Request marked ${status.toLowerCase()}`);
      fetchRequests();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to update request");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}

      <Link
        href="/store-inventory"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Store Inventory
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <ClipboardList className="w-7 h-7" />
          Restock Requests
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Items requested for restock. {canAction ? "Mark them ordered, received, or canceled." : "Track status here."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key || "all"}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === tab.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No requests in this status</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const purchaseLink = getPurchaseLink(request);
            return (
            <div key={request.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/store-inventory/${request.itemId}`}
                      className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {request.item?.name ?? "Item"}
                    </Link>
                    {purchaseLink && (
                      <a
                        href={purchaseLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Purchase link
                      </a>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                    Requested {request.requestedQty} {request.item?.unit ?? ""} by{" "}
                    {request.requestedByUser?.name ?? "Unknown"} on {new Date(request.createdAt).toLocaleDateString()}
                  </div>
                  {request.notes && (
                    <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">{request.notes}</div>
                  )}
                  {request.actionedByUser && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {RESTOCK_STATUS_STYLES[request.status].label} by {request.actionedByUser.name}
                      {request.actionedAt ? ` on ${new Date(request.actionedAt).toLocaleDateString()}` : ""}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${RESTOCK_STATUS_STYLES[request.status].classes}`}
                  >
                    {RESTOCK_STATUS_STYLES[request.status].label}
                  </span>
                  {canAction && request.status === "REQUESTED" && (
                    <div className="flex gap-2">
                      <button
                        disabled={busyId === request.id}
                        onClick={() => handleAction(request.id, "ORDERED")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 disabled:opacity-50"
                      >
                        Mark Ordered
                      </button>
                      <button
                        disabled={busyId === request.id}
                        onClick={() => handleAction(request.id, "CANCELED")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  )}
                  {canAction && request.status === "ORDERED" && (
                    <button
                      disabled={busyId === request.id}
                      onClick={() => handleAction(request.id, "RECEIVED")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Mark Received
                    </button>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

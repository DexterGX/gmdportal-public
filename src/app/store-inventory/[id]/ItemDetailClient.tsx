"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShoppingCart,
  RotateCcw,
  Undo2,
  Pencil,
  ExternalLink,
  Star,
  Plus,
  Trash2,
  Clock,
  Archive,
  MapPin,
} from "lucide-react";
import ItemFormModal, { type StoreItemFormValues, type ProviderOption } from "../ui/ItemFormModal";
import RequestRestockModal from "../ui/RequestRestockModal";
import ReturnItemModal from "../ui/ReturnItemModal";
import AddToCartModal from "../ui/AddToCartModal";
import LinkProviderModal from "./ui/LinkProviderModal";
import { useCart } from "../CartContext";
import type {
  StoreItem,
  StoreTaxonomy,
  StoreTransaction,
  StoreRestockRequest,
} from "../types";
import { STOCK_STATUS_STYLES, RESTOCK_STATUS_STYLES, TRANSACTION_TYPE_LABELS } from "../types";

type ItemDetail = StoreItem & {
  transactions: StoreTransaction[];
  restockRequests: StoreRestockRequest[];
};

interface Props {
  itemId: string;
  userRole: string;
  canManage: boolean;
}

export default function ItemDetailClient({ itemId, canManage }: Props) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [departments, setDepartments] = useState<StoreTaxonomy[]>([]);
  const [groups, setGroups] = useState<StoreTaxonomy[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showLinkProviderModal, setShowLinkProviderModal] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchItem = useCallback(async () => {
    try {
      const res = await fetch(`/api/store-inventory/items/${itemId}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setItem(data);
    } catch (error) {
      console.error(error);
      showToast("error", "Failed to load item");
    } finally {
      setLoading(false);
    }
  }, [itemId, showToast]);

  useEffect(() => {
    fetchItem();
    Promise.all([
      fetch("/api/store-inventory/departments").then((r) => r.json()),
      fetch("/api/store-inventory/groups").then((r) => r.json()),
      fetch("/api/store-inventory/providers").then((r) => r.json()),
    ]).then(([d, g, p]) => {
      setDepartments(Array.isArray(d) ? d : []);
      setGroups(Array.isArray(g) ? g : []);
      setProviders(Array.isArray(p) ? p : []);
    });
  }, [fetchItem]);

  async function handleSaveItem(values: StoreItemFormValues) {
    try {
      const { providerId, providerSku, providerCost, ...itemPayload } = values;
      const res = await fetch(`/api/store-inventory/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemPayload),
      });
      if (!res.ok) throw new Error("Failed to update item");

      if (providerId) {
        await fetch(`/api/store-inventory/items/${itemId}/providers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId,
            providerSku: providerSku || undefined,
            cost: providerCost ? Number(providerCost) : undefined,
            isPreferred: true,
          }),
        }).catch(() => null);
      }

      setShowEditModal(false);
      showToast("success", "Item updated");
      fetchItem();
    } catch (error) {
      showToast("error", "Failed to update item");
    }
  }

  function handleAddToCart(quantity: number, reason: string) {
    if (!item) return;
    addToCart(item, quantity, reason);
    setShowCartModal(false);
    showToast("success", `Added ${quantity} ${item.unit} to cart`);
  }

  async function handleRestockSubmit(requestedQty: number, notes: string) {
    if (!item) return;
    try {
      const res = await fetch("/api/store-inventory/restock-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, requestedQty, notes }),
      });
      if (!res.ok) throw new Error("Failed to submit request");
      setShowRestockModal(false);
      showToast("success", "Restock requested");
      fetchItem();
    } catch (error) {
      showToast("error", "Failed to submit restock request");
    }
  }

  async function handleReturnSubmit(quantity: number, reason: string) {
    if (!item) return;
    try {
      const res = await fetch(`/api/store-inventory/items/${item.id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to return item");
      }
      setShowReturnModal(false);
      showToast("success", `Returned ${quantity} ${item.unit} to stock`);
      fetchItem();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to return item");
    }
  }

  async function handleArchiveItem() {
    if (!item) return;
    if (!confirm(`Archive "${item.name}"? It will be hidden from the active list, but its history is kept. You can restore it later from Settings.`)) return;
    try {
      const res = await fetch(`/api/store-inventory/items/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to archive item");
      showToast("success", "Item archived");
      router.push("/store-inventory");
    } catch (error) {
      showToast("error", "Failed to archive item");
    }
  }

  async function handleDeleteItem() {
    if (!item) return;
    if (
      !confirm(
        `Permanently delete "${item.name}"? This cannot be undone and will also delete all of its transaction and restock history.`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/store-inventory/items/${item.id}?hard=true`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete item");
      showToast("success", "Item deleted");
      router.push("/store-inventory");
    } catch (error) {
      showToast("error", "Failed to delete item");
    }
  }

  async function handleUnlinkProvider(linkId: string) {
    if (!confirm("Remove this provider from the item?")) return;
    try {
      const res = await fetch(`/api/store-inventory/items/${itemId}/providers?linkId=${linkId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      showToast("success", "Provider removed");
      fetchItem();
    } catch {
      showToast("error", "Failed to remove provider");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (notFound || !item) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Item not found.</p>
        <Link href="/store-inventory" className="text-blue-600 hover:underline">
          Back to Store Inventory
        </Link>
      </div>
    );
  }

  const statusStyle = STOCK_STATUS_STYLES[item.stockStatus];

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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{item.name}</h1>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusStyle.classes}`}>
              {statusStyle.label}
            </span>
          </div>
          <div className="flex gap-2 mt-2">
            {item.department && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300">
                {item.department.label}
              </span>
            )}
            {item.group && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                {item.group.label}
              </span>
            )}
            {item.location && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                <MapPin className="w-3 h-3" />
                {item.location}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowCartModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            <ShoppingCart className="w-4 h-4" />
            Check Out
          </button>
          <button
            onClick={() => setShowRestockModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            Request Restock
          </button>
          <button
            onClick={() => setShowReturnModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
          >
            <Undo2 className="w-4 h-4" />
            Return Item
          </button>
          {canManage && (
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          )}
          {canManage && (
            <button
              onClick={handleArchiveItem}
              className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 dark:border-red-900/50 rounded-md text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              <Archive className="w-4 h-4" />
              Archive
            </button>
          )}
          {canManage && (
            <button
              onClick={handleDeleteItem}
              className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 dark:border-red-900/50 rounded-md text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Stock summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {item.quantity} <span className="text-sm font-normal text-gray-400">{item.unit}</span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">On Hand</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{item.minQuantity}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Minimum</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{item.recommendedQuantity}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Recommended</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{item.pendingRequestCount}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Pending Requests</div>
        </div>
      </div>

      {item.notes && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6 text-sm text-gray-700 dark:text-gray-300">
          {item.notes}
        </div>
      )}

      {/* Providers */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Providers</h2>
          {canManage && (
            <button
              onClick={() => setShowLinkProviderModal(true)}
              className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Link Provider
            </button>
          )}
        </div>
        {item.providers.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No providers linked yet.</p>
        ) : (
          <div className="space-y-2">
            {item.providers.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {p.isPreferred && <Star className="w-4 h-4 text-yellow-500 shrink-0" fill="currentColor" />}
                  <div className="min-w-0">
                    <Link
                      href={`/store-inventory/providers/${p.providerId}`}
                      className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {p.provider.name}
                    </Link>
                    {p.providerSku && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">SKU: {p.providerSku}</span>
                    )}
                    {p.cost != null && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">${p.cost.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.purchaseLink && (
                    <a
                      href={p.purchaseLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 dark:text-blue-400"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {canManage && (
                    <button
                      onClick={() => handleUnlinkProvider(p.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Restock request history */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Restock Requests</h2>
        {item.restockRequests.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No restock requests yet.</p>
        ) : (
          <div className="space-y-2">
            {item.restockRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{r.requestedQty} {item.unit}</span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2">
                    requested by {r.requestedByUser?.name ?? "Unknown"} on {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${RESTOCK_STATUS_STYLES[r.status].classes}`}>
                  {RESTOCK_STATUS_STYLES[r.status].label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Transaction History
        </h2>
        {item.transactions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No movements recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {item.transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {TRANSACTION_TYPE_LABELS[t.type]}
                  </span>
                  <span className={`ml-2 ${t.change >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {t.change >= 0 ? "+" : ""}
                    {t.change}
                  </span>
                  <span className="text-gray-400 ml-2">
                    ({t.oldQuantity} → {t.newQuantity})
                  </span>
                  {t.reason && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.reason}</div>}
                </div>
                <div className="text-right text-xs text-gray-500 dark:text-gray-400 shrink-0">
                  <div>{t.user?.name ?? "System"}</div>
                  <div>{new Date(t.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showEditModal && (
        <ItemFormModal
          item={item}
          departments={departments.filter((d) => d.isActive)}
          groups={groups.filter((g) => g.isActive)}
          providers={providers}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveItem}
        />
      )}

      {showCartModal && (
        <AddToCartModal item={item} onClose={() => setShowCartModal(false)} onSubmit={handleAddToCart} />
      )}

      {showRestockModal && (
        <RequestRestockModal item={item} onClose={() => setShowRestockModal(false)} onSubmit={handleRestockSubmit} />
      )}

      {showReturnModal && (
        <ReturnItemModal item={item} onClose={() => setShowReturnModal(false)} onSubmit={handleReturnSubmit} />
      )}

      {showLinkProviderModal && (
        <LinkProviderModal
          itemId={item.id}
          existingProviderIds={item.providers.map((p) => p.providerId)}
          onClose={() => setShowLinkProviderModal(false)}
          onLinked={() => {
            setShowLinkProviderModal(false);
            showToast("success", "Provider linked");
            fetchItem();
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Papa from "papaparse";
import {
  Search,
  Plus,
  Package,
  AlertTriangle,
  ClipboardList,
  Printer,
  ChevronDown,
  Download,
  X,
  ShoppingCart,
  RotateCcw,
  Pencil,
  Archive,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useSidebar } from "@/context/SidebarContext";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";
import ItemFormModal, { type StoreItemFormValues, type ProviderOption } from "./ui/ItemFormModal";
import RequestRestockModal from "./ui/RequestRestockModal";
import AddToCartModal from "./ui/AddToCartModal";
import { useCart } from "./CartContext";
import type { StoreItem, StoreTaxonomy, StoreRestockRequest } from "./types";
import { STOCK_STATUS_STYLES as STATUS_STYLES, RESTOCK_STATUS_STYLES } from "./types";

type PrintMode = "items" | "lowStock" | "requests";

export type { StoreItem, StoreTaxonomy } from "./types";

interface Props {
  userRole: string;
  userId: string;
  canManage: boolean;
}

export default function StoreInventoryClient({ userRole, userId, canManage }: Props) {
  const { isMobileOpen, isMobile } = useSidebar();
  const { addToCart, totalItems: cartCount } = useCart();

  const [items, setItems] = useState<StoreItem[]>([]);
  const [departments, setDepartments] = useState<StoreTaxonomy[]>([]);
  const [groups, setGroups] = useState<StoreTaxonomy[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [pendingRequestTotal, setPendingRequestTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedStockStatuses, setSelectedStockStatuses] = useState<string[]>([]);

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);

  const [cartTarget, setCartTarget] = useState<StoreItem | null>(null);
  const [restockTarget, setRestockTarget] = useState<StoreItem | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode | null>(null);
  const [printRequests, setPrintRequests] = useState<StoreRestockRequest[]>([]);
  const [printLoading, setPrintLoading] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => setSearchTerm(searchInput.trim()), 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (!showPrintMenu) return;
    function handleClickOutside(event: MouseEvent) {
      if (printMenuRef.current && !printMenuRef.current.contains(event.target as Node)) {
        setShowPrintMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPrintMenu]);

  useEffect(() => {
    if (!printMode) return;
    const handle = setTimeout(() => window.print(), 50);
    return () => clearTimeout(handle);
  }, [printMode]);

  useEffect(() => {
    function handleAfterPrint() {
      setPrintMode(null);
    }
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const fetchTaxonomy = useCallback(async () => {
    try {
      const [deptRes, groupRes, providerRes] = await Promise.all([
        fetch("/api/store-inventory/departments"),
        fetch("/api/store-inventory/groups"),
        fetch("/api/store-inventory/providers"),
      ]);
      setDepartments(await deptRes.json());
      setGroups(await groupRes.json());
      setProviders(await providerRes.json());
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    const shouldShowLoading = !hasLoaded;
    if (shouldShowLoading) setLoading(true);
    setIsFetching(true);
    try {
      const url = new URL("/api/store-inventory/items", window.location.origin);
      if (searchTerm) url.searchParams.set("q", searchTerm);

      const res = await fetch(url.toString());
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      showToast("error", "Failed to load inventory items");
    } finally {
      setIsFetching(false);
      if (shouldShowLoading) setLoading(false);
      setHasLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const fetchPendingRequestTotal = useCallback(async () => {
    try {
      const res = await fetch("/api/store-inventory/restock-requests?status=REQUESTED");
      const data = await res.json();
      setPendingRequestTotal(Array.isArray(data) ? data.length : 0);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    fetchTaxonomy();
    fetchPendingRequestTotal();
  }, [fetchTaxonomy, fetchPendingRequestTotal]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const clearFilters = () => {
    setSearchInput("");
    setSearchTerm("");
    setSelectedDepartments([]);
    setSelectedGroups([]);
    setSelectedStockStatuses([]);
  };

  const hasActiveFilters = Boolean(
    searchTerm ||
      selectedDepartments.length > 0 ||
      selectedGroups.length > 0 ||
      selectedStockStatuses.length > 0,
  );

  const activeDepartments = useMemo(() => departments.filter((d) => d.isActive), [departments]);
  const activeGroups = useMemo(() => groups.filter((g) => g.isActive), [groups]);
  const departmentOptions = useMemo(() => activeDepartments.map((d) => d.label), [activeDepartments]);
  const groupOptions = useMemo(() => activeGroups.map((g) => g.label), [activeGroups]);
  const stockStatusOptions = ["Critical", "Low", "OK"];

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedDepartments.length > 0 && !selectedDepartments.includes(item.department?.label ?? "")) {
        return false;
      }
      if (selectedGroups.length > 0 && !selectedGroups.includes(item.group?.label ?? "")) {
        return false;
      }
      if (
        selectedStockStatuses.length > 0 &&
        !selectedStockStatuses.includes(STATUS_STYLES[item.stockStatus].label)
      ) {
        return false;
      }
      return true;
    });
  }, [items, selectedDepartments, selectedGroups, selectedStockStatuses]);

  const stats = useMemo(() => {
    const total = items.length;
    const low = items.filter((i) => i.stockStatus === "low").length;
    const critical = items.filter((i) => i.stockStatus === "critical").length;
    return { total, low, critical };
  }, [items]);

  function openNew() {
    setEditingItem(null);
    setShowItemModal(true);
  }

  function openEdit(item: StoreItem) {
    setEditingItem(item);
    setShowItemModal(true);
  }

  async function handleSaveItem(values: StoreItemFormValues) {
    try {
      const isEdit = Boolean(editingItem);
      const { providerId, providerSku, providerCost, ...itemPayload } = values;
      const res = await fetch(
        isEdit ? `/api/store-inventory/items/${editingItem!.id}` : "/api/store-inventory/items",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemPayload),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save item");
      }
      const savedItem = await res.json();

      if (providerId) {
        await fetch(`/api/store-inventory/items/${savedItem.id}/providers`, {
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

      setShowItemModal(false);
      showToast("success", isEdit ? "Item updated" : "Item added");
      fetchItems();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to save item");
    }
  }

  function handleAddToCart(quantity: number, reason: string) {
    if (!cartTarget) return;
    addToCart(cartTarget, quantity, reason);
    showToast("success", `Added ${quantity} ${cartTarget.unit} of ${cartTarget.name} to cart`);
    setCartTarget(null);
  }

  async function handleArchive(item: StoreItem) {
    if (!confirm(`Archive "${item.name}"? It will be hidden from the active list, but its history is kept. You can restore it later from Settings.`)) return;
    try {
      const res = await fetch(`/api/store-inventory/items/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to archive item");
      showToast("success", "Item archived");
      fetchItems();
    } catch (error) {
      showToast("error", "Failed to archive item");
    }
  }

  async function handleDelete(item: StoreItem) {
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
      fetchItems();
    } catch (error) {
      showToast("error", "Failed to delete item");
    }
  }

  async function handleRestockSubmit(requestedQty: number, notes: string) {
    if (!restockTarget) return;
    try {
      const res = await fetch("/api/store-inventory/restock-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: restockTarget.id, requestedQty, notes }),
      });
      if (!res.ok) throw new Error("Failed to submit restock request");
      setRestockTarget(null);
      showToast("success", `Restock requested for ${restockTarget.name}`);
      fetchItems();
      fetchPendingRequestTotal();
    } catch (error) {
      showToast("error", "Failed to submit restock request");
    }
  }

  const printItems = useMemo(() => {
    if (printMode === "lowStock") {
      return items.filter((item) => item.stockStatus === "low" || item.stockStatus === "critical");
    }
    return visibleItems;
  }, [printMode, items, visibleItems]);

  async function runPrint(mode: PrintMode) {
    setShowPrintMenu(false);
    if (mode === "requests") {
      setPrintLoading(true);
      try {
        const res = await fetch("/api/store-inventory/restock-requests");
        const data = await res.json();
        setPrintRequests(Array.isArray(data) ? data : []);
      } catch (error) {
        showToast("error", "Failed to load restock requests for printing");
        setPrintLoading(false);
        return;
      }
      setPrintLoading(false);
    }
    setPrintMode(mode);
  }

  function exportCsv() {
    const csv = Papa.unparse(
      visibleItems.map((item) => ({
        Name: item.name,
        Department: item.department?.label ?? "",
        Group: item.group?.label ?? "",
        Unit: item.unit,
        Quantity: item.quantity,
        "Min Qty": item.minQuantity,
        "Recommended Qty": item.recommendedQuantity,
        Status: STATUS_STYLES[item.stockStatus].label,
        Provider: item.providers.find((p) => p.isPreferred)?.provider.name ?? item.providers[0]?.provider.name ?? "",
        "Purchase Link": item.purchaseLink ?? "",
      })),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `store-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className={`max-w-7xl mx-auto transition-opacity ${
        isMobile && isMobileOpen ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 print:hidden">
        <div>
          <h1 className="text-3xl font-bold">Store Inventory</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Check work items in and out, and keep stock levels healthy.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/store-inventory/checkout"
            className="relative inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            <ShoppingCart className="w-4 h-4" />
            Check Out Items
            {cartCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-blue-600 text-white text-xs font-semibold">
                {cartCount}
              </span>
            )}
          </Link>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <div className="relative" ref={printMenuRef}>
            <button
              onClick={() => setShowPrintMenu((prev) => !prev)}
              disabled={printLoading}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              {printLoading ? "Preparing..." : "Print"}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPrintMenu ? "rotate-180" : ""}`} />
            </button>

            {showPrintMenu && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
                <button
                  onClick={() => runPrint("items")}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  All Items
                </button>
                <button
                  onClick={() => runPrint("lowStock")}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Low / Critical Stock
                </button>
                <button
                  onClick={() => runPrint("requests")}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Restock Requests
                </button>
              </div>
            )}
          </div>
          {canManage && (
            <button
              onClick={openNew}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-5 h-5" />
              Add Item
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 print:hidden">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
              <Package className="w-5 h-5 text-blue-700 dark:text-blue-300" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Active Items</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-yellow-100 dark:bg-yellow-900/30">
              <AlertTriangle className="w-5 h-5 text-yellow-700 dark:text-yellow-300" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.low}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Low Stock</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="w-5 h-5 text-red-700 dark:text-red-300" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.critical}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Critical Stock</div>
            </div>
          </div>
        </div>
        <Link
          href="/store-inventory/requests"
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900/30">
              <ClipboardList className="w-5 h-5 text-purple-700 dark:text-purple-300" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pendingRequestTotal}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Pending Restock Requests</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6 print:hidden">
        {isFetching && hasLoaded && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Updating results...</div>
        )}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full h-10 pl-10 pr-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterMultiSelect
              label="Department"
              options={departmentOptions}
              selected={selectedDepartments}
              onChange={setSelectedDepartments}
              matchInputStyle
            />
            <FilterMultiSelect
              label="Group"
              options={groupOptions}
              selected={selectedGroups}
              onChange={setSelectedGroups}
              matchInputStyle
            />
            <FilterMultiSelect
              label="Stock Level"
              options={stockStatusOptions}
              selected={selectedStockStatuses}
              onChange={setSelectedStockStatuses}
              matchInputStyle
            />
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <X className="w-3.5 h-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {/* Items */}
      <div className="print:hidden">
      {visibleItems.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            {hasActiveFilters ? "No items match your filters" : "No inventory items yet"}
          </p>
          {canManage && !hasActiveFilters && (
            <button onClick={openNew} className="inline-block mt-4 text-blue-600 hover:text-blue-700">
              Add your first item
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Group
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Qty / Min / Rec.
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {visibleItems.map((item) => {
                  const preferredProvider =
                    item.providers.find((p) => p.isPreferred) ?? item.providers[0] ?? null;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-6 py-4 text-left">
                        <Link
                          href={`/store-inventory/${item.id}`}
                          className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {item.name}
                        </Link>
                        {item.notes && (
                          <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 line-clamp-1">
                            {item.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.department ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300">
                            {item.department.label}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.group ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                            {item.group.label}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-gray-100">
                        {item.quantity} / {item.minQuantity} / {item.recommendedQuantity}{" "}
                        <span className="text-gray-400">{item.unit}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[item.stockStatus].classes}`}
                        >
                          {STATUS_STYLES[item.stockStatus].label}
                        </span>
                        {item.pendingRequestCount > 0 && (
                          <div className="text-[10px] text-purple-600 dark:text-purple-400 mt-1">
                            {item.pendingRequestCount} pending request
                            {item.pendingRequestCount > 1 ? "s" : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-gray-300">
                        {preferredProvider ? (
                          <div className="flex items-center justify-center gap-1">
                            {preferredProvider.provider.name}
                            {item.purchaseLink && (
                              <a
                                href={item.purchaseLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 dark:text-blue-400"
                                title="Purchase link"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setCartTarget(item)}
                            title="Check Out"
                            className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600"
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRestockTarget(item)}
                            title="Request Restock"
                            className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-600"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => openEdit(item)}
                                title="Edit"
                                className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleArchive(item)}
                                title="Archive"
                                className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(item)}
                                title="Delete Permanently"
                                className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {visibleItems.map((item) => {
              const preferredProvider = item.providers.find((p) => p.isPreferred) ?? item.providers[0] ?? null;
              return (
                <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                  <div className="flex items-start justify-between mb-2">
                    <Link
                      href={`/store-inventory/${item.id}`}
                      className="font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {item.name}
                    </Link>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[item.stockStatus].classes}`}
                    >
                      {STATUS_STYLES[item.stockStatus].label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
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
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    Qty {item.quantity} {item.unit} · Min {item.minQuantity} · Rec. {item.recommendedQuantity}
                  </div>
                  {preferredProvider && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Provider: {preferredProvider.provider.name}
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setCartTarget(item)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Check Out
                    </button>
                    <button
                      onClick={() => setRestockTarget(item)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restock
                    </button>
                    {canManage && (
                      <button
                        onClick={() => openEdit(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    )}
                    {canManage && (
                      <button
                        onClick={() => handleArchive(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        Archive
                      </button>
                    )}
                    {canManage && (
                      <button
                        onClick={() => handleDelete(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      </div>

      {/* Print-only content */}
      <div id="print-area" className="hidden print:block">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-black">
            {printMode === "requests"
              ? "Store Inventory — Restock Requests"
              : printMode === "lowStock"
                ? "Store Inventory — Low & Critical Stock"
                : "Store Inventory — Item List"}
          </h1>
          <p className="text-xs text-gray-600">Printed {new Date().toLocaleString()}</p>
        </div>

        {printMode === "requests" ? (
          printRequests.length === 0 ? (
            <p className="text-sm text-gray-600">No restock requests to show.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Item</th>
                  <th className="text-left">Qty Requested</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Requested By</th>
                  <th className="text-left">Requested On</th>
                  <th className="text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {printRequests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.item?.name ?? "Item"}</td>
                    <td>
                      {r.requestedQty} {r.item?.unit ?? ""}
                    </td>
                    <td>{RESTOCK_STATUS_STYLES[r.status].label}</td>
                    <td>{r.requestedByUser?.name ?? "—"}</td>
                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td>{r.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : printItems.length === 0 ? (
          <p className="text-sm text-gray-600">No items to show.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">Item</th>
                <th className="text-left">Department</th>
                <th className="text-left">Group</th>
                <th className="text-left">Qty</th>
                <th className="text-left">Min</th>
                <th className="text-left">Rec.</th>
                <th className="text-left">Status</th>
                <th className="text-left">Provider</th>
              </tr>
            </thead>
            <tbody>
              {printItems.map((item) => {
                const preferredProvider = item.providers.find((p) => p.isPreferred) ?? item.providers[0] ?? null;
                return (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.department?.label ?? "—"}</td>
                    <td>{item.group?.label ?? "—"}</td>
                    <td>
                      {item.quantity} {item.unit}
                    </td>
                    <td>{item.minQuantity}</td>
                    <td>{item.recommendedQuantity}</td>
                    <td>{STATUS_STYLES[item.stockStatus].label}</td>
                    <td>{preferredProvider?.provider.name ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showItemModal && (
        <ItemFormModal
          item={editingItem}
          departments={activeDepartments}
          groups={activeGroups}
          providers={providers}
          onClose={() => setShowItemModal(false)}
          onSave={handleSaveItem}
        />
      )}

      {cartTarget && (
        <AddToCartModal item={cartTarget} onClose={() => setCartTarget(null)} onSubmit={handleAddToCart} />
      )}

      {restockTarget && (
        <RequestRestockModal
          item={restockTarget}
          onClose={() => setRestockTarget(null)}
          onSubmit={handleRestockSubmit}
        />
      )}
    </div>
  );
}

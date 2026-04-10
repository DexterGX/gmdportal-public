"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Search, Plus, Trash2, Edit2, Check, X } from "lucide-react";

const SLAB_VIEW_LICENSE = "532b5c05af7b036ff8a0200d0c8dc6da";
const buildSlabViewUrl = (scannerId: string) =>
  `https://fusiondrivecloud.com/slabview/?license=${SLAB_VIEW_LICENSE}&SlabID=${encodeURIComponent(scannerId)}`;

type BaySlab = {
  id: string;
  scannerId: string;
  name: string;
  type: string;
  thickness: string;
  size: string;
  clientName: string;
  brand: string | null;
  finish: string | null;
  batchIndex: number | null;
  batchSize: number | null;
};

type PromoSlab = {
  id: string;
  slabBaySlabId: string;
  price: number;
  status: string;
  soldToClientName: string | null;
  scannerId: string | null;
  name: string;
  type: string;
  thickness: string;
  size: string;
  clientName: string;
  brand: string | null;
  finish: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  ON_HOLD:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  SOLD: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  ON_HOLD: "On Hold",
  SOLD: "Sold",
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    price,
  );

export default function AdminPromotionalClient() {
  const [promoRows, setPromoRows] = useState<PromoSlab[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Add slab picker state
  const [addSearch, setAddSearch] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [pickerResults, setPickerResults] = useState<BaySlab[]>([]);
  const [selectedBaySlab, setSelectedBaySlab] = useState<BaySlab | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Edit price state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");

  const fetchPromo = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/slabs/promotional", { cache: "no-store" });
      if (res.ok) setPromoRows(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPromo();
  }, []);

  // Click-outside for picker dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounce bay-slab search for picker
  useEffect(() => {
    if (!addSearch.trim() || selectedBaySlab) return;
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/slabs/promotional/bay-slabs?q=${encodeURIComponent(addSearch)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setPickerResults(data);
          setShowPicker(data.length > 0);
        }
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [addSearch, selectedBaySlab]);

  const handleSelectBaySlab = (slab: BaySlab) => {
    setSelectedBaySlab(slab);
    setAddSearch(`${slab.id} — ${slab.name}`);
    setShowPicker(false);
  };

  const handleAdd = async () => {
    if (!selectedBaySlab) return;
    const priceNum = parseFloat(addPrice);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      alert("Please enter a valid price.");
      return;
    }
    setIsAdding(true);
    try {
      const res = await fetch("/api/slabs/promotional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slabBaySlabId: selectedBaySlab.id,
          price: priceNum,
        }),
      });
      if (!res.ok) throw new Error("Failed to add slab");
      setAddSearch("");
      setAddPrice("");
      setSelectedBaySlab(null);
      setPickerResults([]);
      await fetchPromo();
    } catch {
      alert("Failed to add slab. It may already be in the list.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from the promotional list?`)) return;
    await fetch(`/api/slabs/promotional/${id}`, { method: "DELETE" });
    await fetchPromo();
  };

  const handleSavePrice = async (row: PromoSlab) => {
    const priceNum = parseFloat(editPrice);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      alert("Please enter a valid price.");
      return;
    }
    await fetch(`/api/slabs/promotional/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: priceNum }),
    });
    setEditingId(null);
    await fetchPromo();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return promoRows;
    return promoRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.slabBaySlabId.toLowerCase().includes(q) ||
        (r.brand ?? "").toLowerCase().includes(q),
    );
  }, [promoRows, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
          Manage Promotional Slabs
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Add, price, and remove slabs from the promotional list.
        </p>
      </div>

      {/* Add Slab Card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Slab to Promotional List
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          {/* Slab search picker */}
          <div className="flex-1 relative" ref={pickerRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={addSearch}
                onChange={(e) => {
                  setAddSearch(e.target.value);
                  setSelectedBaySlab(null);
                }}
                placeholder="Search SlabBay by ID or name (GMD/Remnant only)..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {showPicker && (
              <ul className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                {isSearching ? (
                  <li className="px-3 py-2 text-sm text-gray-400">
                    Searching...
                  </li>
                ) : (
                  pickerResults.map((slab) => (
                    <li key={slab.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectBaySlab(slab)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {slab.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {slab.id} · {slab.type} · {slab.brand ?? "No brand"} ·{" "}
                          {slab.thickness} · {slab.size}
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {/* Price input */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={addPrice}
              onChange={(e) => setAddPrice(e.target.value)}
              placeholder="Price"
              className="w-32 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedBaySlab || !addPrice || isAdding}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAdding ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Add
          </button>
        </div>

        {/* Selected slab preview */}
        {selectedBaySlab && (
          <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300">
            <span className="font-medium">{selectedBaySlab.name}</span> ·{" "}
            {selectedBaySlab.type} · {selectedBaySlab.brand ?? "No brand"} ·{" "}
            {selectedBaySlab.thickness} · {selectedBaySlab.size}
            {selectedBaySlab.scannerId && (
              <>
                {" · Scanner: "}
                <a
                  href={buildSlabViewUrl(selectedBaySlab.scannerId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {selectedBaySlab.scannerId}
                </a>
              </>
            )}
          </div>
        )}
      </div>

      {/* Existing Promotional Slabs Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
            Current Promotional Slabs ({promoRows.length})
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter current list..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {promoRows.length === 0
              ? "No promotional slabs yet. Add one above."
              : "No matches for your search."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  <th className="py-2 pr-4 whitespace-nowrap">Slab ID</th>
                  <th className="py-2 pr-4 whitespace-nowrap">Scanner ID</th>
                  <th className="py-2 pr-4 whitespace-nowrap">Name</th>
                  <th className="py-2 pr-4 whitespace-nowrap">Brand</th>
                  <th className="py-2 pr-4 whitespace-nowrap">Finish</th>
                  <th className="py-2 pr-4 whitespace-nowrap">Thickness</th>
                  <th className="py-2 pr-4 whitespace-nowrap">Size</th>
                  <th className="py-2 pr-4 whitespace-nowrap">Type</th>
                  <th className="py-2 pr-4 whitespace-nowrap">Price</th>
                  <th className="py-2 pr-4 whitespace-nowrap">Status</th>
                  <th className="py-2 pr-4 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 font-mono text-xs">
                      {row.slabBaySlabId}
                    </td>
                    <td className="py-3 pr-4">
                      {row.scannerId ? (
                        <a
                          href={buildSlabViewUrl(row.scannerId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline font-mono text-xs"
                        >
                          {row.scannerId}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-800 dark:text-gray-200 font-medium">
                      {row.name}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {row.brand || "-"}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {row.finish || "-"}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {row.thickness}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {row.size}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {row.type}
                    </td>
                    <td className="py-3 pr-4">
                      {editingId === row.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500 text-xs">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-24 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSavePrice(row)}
                            className="text-emerald-600 hover:text-emerald-700 p-1"
                            title="Save"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(row.id);
                            setEditPrice(String(row.price));
                          }}
                          className="font-medium text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 group"
                        >
                          {formatPrice(row.price)}
                          <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[row.status] ?? ""}`}
                      >
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id, row.name)}
                        className="text-red-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Remove from promotional list"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

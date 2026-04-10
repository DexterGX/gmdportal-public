"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Search, X } from "lucide-react";
import MultiSelectDropdown, {
  MultiSelectOption,
} from "../ui/MultiSelectDropdown";

const SLAB_VIEW_LICENSE = "532b5c05af7b036ff8a0200d0c8dc6da";
const buildSlabViewUrl = (scannerId: string) =>
  `https://fusiondrivecloud.com/slabview/?license=${SLAB_VIEW_LICENSE}&SlabID=${encodeURIComponent(scannerId)}`;

export type PromoSlab = {
  id: string;
  slabBaySlabId: string;
  price: number;
  status: "AVAILABLE" | "ON_HOLD" | "SOLD";
  soldToClientName: string | null;
  scannerId: string | null;
  name: string;
  type: "GMD" | "REMNANT";
  thickness: string;
  size: string;
  clientName: string;
  brand: string | null;
  finish: string | null;
  batchIndex: number | null;
  batchSize: number | null;
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  ON_HOLD: "On Hold",
  SOLD: "Sold",
};

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  ON_HOLD:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  SOLD: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

interface SoldModalProps {
  slab: PromoSlab;
  onConfirm: (clientName: string) => void;
  onClose: () => void;
}

function SoldModal({ slab, onConfirm, onClose }: SoldModalProps) {
  const [clientSearch, setClientSearch] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clientSearch.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/slab-rack-display/clients?q=${encodeURIComponent(clientSearch)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          setShowDropdown(data.length > 0);
        }
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [clientSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (name: string) => {
    setSelectedClient(name);
    setClientSearch(name);
    setShowDropdown(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Mark as Sold
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Slab: <span className="font-medium">{slab.name}</span> (
          {slab.slabBaySlabId})
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Client Name
          </label>
          <div ref={dropdownRef} className="relative">
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setSelectedClient(e.target.value);
              }}
              placeholder="Search or type client name..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showDropdown && (
              <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => handleSelect(name)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const name = (selectedClient || clientSearch).trim();
              if (!name) return;
              onConfirm(name);
            }}
            disabled={!(selectedClient || clientSearch).trim()}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm Sale
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PromotionalSlabsClient() {
  const [rows, setRows] = useState<PromoSlab[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterBrands, setFilterBrands] = useState<string[]>([]);
  const [filterFinishes, setFilterFinishes] = useState<string[]>([]);
  const [filterThicknesses, setFilterThicknesses] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [soldTarget, setSoldTarget] = useState<PromoSlab | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/slabs/promotional", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setRows(data as PromoSlab[]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Derived filter options from loaded data
  const typeOptions = useMemo<MultiSelectOption[]>(() => {
    const types = Array.from(new Set(rows.map((r) => r.type))).sort();
    return types.map((t) => ({ value: t, label: t }));
  }, [rows]);

  const brandOptions = useMemo<MultiSelectOption[]>(() => {
    const brands = Array.from(
      new Set(rows.map((r) => r.brand ?? "").filter(Boolean)),
    ).sort();
    return brands.map((b) => ({ value: b, label: b }));
  }, [rows]);

  const finishOptions = useMemo<MultiSelectOption[]>(() => {
    const finishes = Array.from(
      new Set(rows.map((r) => r.finish ?? "").filter(Boolean)),
    ).sort();
    return finishes.map((f) => ({ value: f, label: f }));
  }, [rows]);

  const thicknessOptions = useMemo<MultiSelectOption[]>(() => {
    const thicknesses = Array.from(
      new Set(rows.map((r) => r.thickness).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return thicknesses.map((t) => ({ value: t, label: t }));
  }, [rows]);

  const statusOptions = useMemo<MultiSelectOption[]>(
    () => [
      { value: "AVAILABLE", label: "Available" },
      { value: "ON_HOLD", label: "On Hold" },
      { value: "SOLD", label: "Sold" },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const matchSearch =
          r.name.toLowerCase().includes(q) ||
          r.slabBaySlabId.toLowerCase().includes(q) ||
          (r.brand ?? "").toLowerCase().includes(q);
        if (!matchSearch) return false;
      }
      if (filterTypes.length > 0 && !filterTypes.includes(r.type)) return false;
      if (filterBrands.length > 0 && !filterBrands.includes(r.brand ?? ""))
        return false;
      if (filterFinishes.length > 0 && !filterFinishes.includes(r.finish ?? ""))
        return false;
      if (
        filterThicknesses.length > 0 &&
        !filterThicknesses.includes(r.thickness)
      )
        return false;
      if (filterStatuses.length > 0 && !filterStatuses.includes(r.status))
        return false;
      return true;
    });
  }, [
    rows,
    search,
    filterTypes,
    filterBrands,
    filterFinishes,
    filterThicknesses,
    filterStatuses,
  ]);

  const handleClearFilters = () => {
    setSearch("");
    setFilterTypes([]);
    setFilterBrands([]);
    setFilterFinishes([]);
    setFilterThicknesses([]);
    setFilterStatuses([]);
  };

  const updateStatus = async (
    slab: PromoSlab,
    status: string,
    soldToClientName?: string,
  ) => {
    setActionLoading(slab.id);
    try {
      const res = await fetch(`/api/slabs/promotional/${slab.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, soldToClientName }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchData();
    } catch {
      alert("Failed to update slab status. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSoldConfirm = async (clientName: string) => {
    if (!soldTarget) return;
    setSoldTarget(null);
    await updateStatus(soldTarget, "SOLD", clientName);
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);

  const hasActiveFilters =
    search ||
    filterTypes.length > 0 ||
    filterBrands.length > 0 ||
    filterFinishes.length > 0 ||
    filterThicknesses.length > 0 ||
    filterStatuses.length > 0;

  return (
    <>
      {soldTarget && (
        <SoldModal
          slab={soldTarget}
          onConfirm={handleSoldConfirm}
          onClose={() => setSoldTarget(null)}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
            Promotional Slabs
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            GMD and Remnant slabs available at special prices.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {/* Text search */}
            <div className="relative xl:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, ID, brand"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <MultiSelectDropdown
              label="Type"
              options={typeOptions}
              selectedValues={filterTypes}
              onChange={setFilterTypes}
            />
            <MultiSelectDropdown
              label="Brand"
              options={brandOptions}
              selectedValues={filterBrands}
              onChange={setFilterBrands}
            />
            <MultiSelectDropdown
              label="Finish"
              options={finishOptions}
              selectedValues={filterFinishes}
              onChange={setFilterFinishes}
            />
            <MultiSelectDropdown
              label="Thickness"
              options={thicknessOptions}
              selectedValues={filterThicknesses}
              onChange={setFilterThicknesses}
            />
            <MultiSelectDropdown
              label="Status"
              options={statusOptions}
              selectedValues={filterStatuses}
              onChange={setFilterStatuses}
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {filtered.length} of {rows.length} slabs
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" /> Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 overflow-x-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Loading promotional slabs...
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">
              No promotional slabs found.
            </div>
          ) : (
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
                {filtered.map((slab) => {
                  const isWorking = actionLoading === slab.id;
                  return (
                    <tr
                      key={slab.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 font-mono text-xs">
                        {slab.slabBaySlabId}
                      </td>
                      <td className="py-3 pr-4">
                        {slab.scannerId ? (
                          <a
                            href={buildSlabViewUrl(slab.scannerId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-mono text-xs"
                          >
                            {slab.scannerId}
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-800 dark:text-gray-200 font-medium">
                        {slab.name}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                        {slab.brand || "-"}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                        {slab.finish || "-"}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                        {slab.thickness}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                        {slab.size}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                        {slab.type}
                      </td>
                      <td className="py-3 pr-4 text-gray-800 dark:text-gray-200 font-medium">
                        {formatPrice(slab.price)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[slab.status]}`}
                        >
                          {STATUS_LABELS[slab.status]}
                        </span>
                        {slab.status === "SOLD" && slab.soldToClientName && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {slab.soldToClientName}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-1.5 flex-wrap">
                          {slab.status !== "AVAILABLE" && (
                            <button
                              type="button"
                              disabled={isWorking}
                              onClick={() => updateStatus(slab, "AVAILABLE")}
                              className="px-2.5 py-1 text-xs rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/40 disabled:opacity-50"
                            >
                              Available
                            </button>
                          )}
                          {slab.status !== "ON_HOLD" && (
                            <button
                              type="button"
                              disabled={isWorking}
                              onClick={() => updateStatus(slab, "ON_HOLD")}
                              className="px-2.5 py-1 text-xs rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-900/40 disabled:opacity-50"
                            >
                              On Hold
                            </button>
                          )}
                          {slab.status !== "SOLD" && (
                            <button
                              type="button"
                              disabled={isWorking}
                              onClick={() => setSoldTarget(slab)}
                              className="px-2.5 py-1 text-xs rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/40 disabled:opacity-50"
                            >
                              Sold
                            </button>
                          )}
                          {isWorking && (
                            <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import MultiSelectDropdown, { MultiSelectOption } from "./MultiSelectDropdown";

// TODO: Replace with actual types from schema
type SlabFinish = "polished" | "matte" | "leather" | "other";
type SlabThickness = "8mm" | "12mm" | "20mm" | "30mm";

type SlabAvailabilityItem = {
  id: string;
  provider: string;
  colorName: string;
  series?: string;
  finish: SlabFinish;
  thickness: SlabThickness;
  size?: string;
  isPromo?: boolean;
  stockQty?: number;
  location?: string;
};

// TODO: Replace with actual data from API/database
const MOCK_AVAILABILITY_DATA: SlabAvailabilityItem[] = [
  {
    id: "1",
    provider: "Caesarstone",
    colorName: "Calacatta Nuvo",
    series: "Supernatural",
    finish: "polished",
    thickness: "20mm",
    size: "3000x1440mm",
    isPromo: true,
    stockQty: 12,
    location: "Warehouse A",
  },
  {
    id: "2",
    provider: "Caesarstone",
    colorName: "Statuario Maximus",
    series: "Supernatural",
    finish: "polished",
    thickness: "12mm",
    size: "3000x1440mm",
    isPromo: false,
    stockQty: 8,
    location: "Warehouse A",
  },
  {
    id: "3",
    provider: "Silestone",
    colorName: "Eternal Calacatta Gold",
    series: "Eternal",
    finish: "polished",
    thickness: "12mm",
    size: "3050x1440mm",
    isPromo: true,
    stockQty: 15,
    location: "Warehouse B",
  },
  {
    id: "4",
    provider: "Silestone",
    colorName: "Lagoon",
    finish: "matte",
    thickness: "20mm",
    size: "3050x1440mm",
    isPromo: false,
    stockQty: 5,
    location: "Warehouse B",
  },
  {
    id: "5",
    provider: "Cambria",
    colorName: "Brittanicca",
    finish: "matte",
    thickness: "20mm",
    size: "3048x1448mm",
    isPromo: true,
    stockQty: 10,
    location: "Warehouse A",
  },
  {
    id: "6",
    provider: "Dekton",
    colorName: "Aura",
    series: "XGloss",
    finish: "polished",
    thickness: "12mm",
    size: "3200x1440mm",
    isPromo: true,
    stockQty: 20,
    location: "Warehouse C",
  },
  {
    id: "7",
    provider: "MSI",
    colorName: "Carrara White",
    series: "Q Quartz",
    finish: "polished",
    thickness: "20mm",
    size: "3048x1448mm",
    isPromo: false,
    stockQty: 6,
    location: "Warehouse A",
  },
  {
    id: "8",
    provider: "LG Viatera",
    colorName: "Aria",
    finish: "leather",
    thickness: "20mm",
    size: "3050x1440mm",
    isPromo: false,
    stockQty: 14,
    location: "Warehouse B",
  },
];

// Filter options for dropdowns
const finishOptions: MultiSelectOption[] = [
  { value: "polished", label: "Polished" },
  { value: "matte", label: "Matte" },
  { value: "leather", label: "Leather" },
  { value: "other", label: "Other" },
];

const thicknessOptions: MultiSelectOption[] = [
  { value: "8mm", label: "8mm" },
  { value: "12mm", label: "12mm" },
  { value: "20mm", label: "20mm" },
  { value: "30mm", label: "30mm" },
];

export default function SlabAvailability() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedFinishes, setSelectedFinishes] = useState<SlabFinish[]>([]);
  const [selectedThicknesses, setSelectedThicknesses] = useState<
    SlabThickness[]
  >([]);
  const [showOnlyPromo, setShowOnlyPromo] = useState(false);
  const [slabs] = useState<SlabAvailabilityItem[]>(MOCK_AVAILABILITY_DATA);

  // TODO: Fetch real data from API
  // useEffect(() => {
  //   async function fetchAvailability() {
  //     const res = await fetch('/api/slabs/availability');
  //     const data = await res.json();
  //     setSlabs(data);
  //   }
  //   fetchAvailability();
  // }, []);

  const uniqueProviders = useMemo(() => {
    return Array.from(new Set(slabs.map((s) => s.provider))).sort();
  }, [slabs]);

  const providerOptions: MultiSelectOption[] = useMemo(() => {
    return uniqueProviders.map((provider) => ({
      value: provider,
      label: provider,
    }));
  }, [uniqueProviders]);

  const filteredSlabs = useMemo(() => {
    let filtered = slabs.filter((slab) => {
      const matchesSearch =
        searchTerm === "" ||
        slab.colorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (slab.series?.toLowerCase().includes(searchTerm.toLowerCase()) ??
          false);

      const matchesProvider =
        selectedProviders.length === 0 ||
        selectedProviders.includes(slab.provider);

      const matchesFinish =
        selectedFinishes.length === 0 || selectedFinishes.includes(slab.finish);

      const matchesThickness =
        selectedThicknesses.length === 0 ||
        selectedThicknesses.includes(slab.thickness);

      const matchesPromo = !showOnlyPromo || slab.isPromo === true;

      return (
        matchesSearch &&
        matchesProvider &&
        matchesFinish &&
        matchesThickness &&
        matchesPromo
      );
    });

    // Sort by provider ASC, then color ASC
    return filtered.sort((a, b) => {
      const providerCompare = a.provider.localeCompare(b.provider);
      if (providerCompare !== 0) return providerCompare;
      return a.colorName.localeCompare(b.colorName);
    });
  }, [
    slabs,
    searchTerm,
    selectedProviders,
    selectedFinishes,
    selectedThicknesses,
    showOnlyPromo,
  ]);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedProviders([]);
    setSelectedFinishes([]);
    setSelectedThicknesses([]);
    setShowOnlyPromo(false);
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    selectedProviders.length > 0 ||
    selectedFinishes.length > 0 ||
    selectedThicknesses.length > 0 ||
    showOnlyPromo;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Availability
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Check current slab availability and stock levels across all locations.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4 overflow-visible">
        {/* Search */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by color or series..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Provider Filter */}
          <MultiSelectDropdown
            label="Brand"
            options={providerOptions}
            selectedValues={selectedProviders}
            onChange={(values) => setSelectedProviders(values)}
          />

          {/* Finish Filter */}
          <MultiSelectDropdown
            label="Finish"
            options={finishOptions}
            selectedValues={selectedFinishes}
            onChange={(values) => setSelectedFinishes(values as SlabFinish[])}
          />

          {/* Thickness Filter */}
          <MultiSelectDropdown
            label="Thickness"
            options={thicknessOptions}
            selectedValues={selectedThicknesses}
            onChange={(values) =>
              setSelectedThicknesses(values as SlabThickness[])
            }
          />

          {/* Promo Toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyPromo}
              onChange={(e) => setShowOnlyPromo(e.target.checked)}
              className="rounded"
            />
            Show only promo slabs
          </label>

          {/* Clear Filters */}
          <button
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
              hasActiveFilters
                ? "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer"
                : "text-gray-400 dark:text-gray-600 cursor-not-allowed"
            }`}
          >
            <X className="w-4 h-4" />
            Clear filters
          </button>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Color
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Series
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Finish
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Thickness
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Promo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSlabs.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    No slabs found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredSlabs.map((slab) => (
                  <tr
                    key={slab.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {slab.provider}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {slab.colorName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {slab.series || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 capitalize">
                      {slab.finish}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {slab.thickness}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {slab.size || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          (slab.stockQty ?? 0) > 10
                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                            : (slab.stockQty ?? 0) > 5
                            ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                            : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                        }`}
                      >
                        {slab.stockQty ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {slab.location || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {slab.isPromo && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          Promo
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-4">
        {filteredSlabs.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
            No slabs found matching your filters.
          </div>
        ) : (
          filteredSlabs.map((slab) => (
            <div
              key={slab.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {slab.colorName}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {slab.provider}
                  </p>
                </div>
                {slab.isPromo && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                    Promo
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Series:
                  </span>{" "}
                  <span className="text-gray-700 dark:text-gray-300">
                    {slab.series || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Finish:
                  </span>{" "}
                  <span className="text-gray-700 dark:text-gray-300 capitalize">
                    {slab.finish}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Thickness:
                  </span>{" "}
                  <span className="text-gray-700 dark:text-gray-300">
                    {slab.thickness}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Size:
                  </span>{" "}
                  <span className="text-gray-700 dark:text-gray-300">
                    {slab.size || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Stock:
                  </span>{" "}
                  <span
                    className={`font-medium ${
                      (slab.stockQty ?? 0) > 10
                        ? "text-green-600 dark:text-green-400"
                        : (slab.stockQty ?? 0) > 5
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {slab.stockQty ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Location:
                  </span>{" "}
                  <span className="text-gray-700 dark:text-gray-300">
                    {slab.location || "—"}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredSlabs.length} of {slabs.length} slabs
      </div>
    </div>
  );
}

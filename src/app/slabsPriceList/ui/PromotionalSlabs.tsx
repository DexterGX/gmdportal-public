"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import MultiSelectDropdown, { MultiSelectOption } from "./MultiSelectDropdown";

// TODO: Replace with actual types from schema
type SlabFinish = "polished" | "matte" | "leather" | "other";
type SlabThickness = "8mm" | "12mm" | "20mm" | "30mm";

type PromotionalSlab = {
  id: string;
  provider: string;
  colorName: string;
  series?: string;
  finish: SlabFinish;
  thickness: SlabThickness;
  size?: string;
  listPrice: number;
  promoPrice: number;
  promotionEndsAt?: string;
};

// TODO: Replace with actual data from API/database
const MOCK_PROMOTIONAL_SLABS: PromotionalSlab[] = [
  {
    id: "1",
    provider: "Caesarstone",
    colorName: "Calacatta Nuvo",
    series: "Supernatural",
    finish: "polished",
    thickness: "20mm",
    size: "3000x1440mm",
    listPrice: 89.99,
    promoPrice: 69.99,
    promotionEndsAt: "2025-12-31",
  },
  {
    id: "2",
    provider: "Silestone",
    colorName: "Eternal Calacatta Gold",
    series: "Eternal",
    finish: "polished",
    thickness: "12mm",
    size: "3050x1440mm",
    listPrice: 79.99,
    promoPrice: 59.99,
    promotionEndsAt: "2025-11-30",
  },
  {
    id: "3",
    provider: "Cambria",
    colorName: "Brittanicca",
    finish: "matte",
    thickness: "20mm",
    size: "3048x1448mm",
    listPrice: 94.99,
    promoPrice: 74.99,
    promotionEndsAt: "2026-01-15",
  },
  {
    id: "4",
    provider: "Dekton",
    colorName: "Aura",
    series: "XGloss",
    finish: "polished",
    thickness: "12mm",
    size: "3200x1440mm",
    listPrice: 84.99,
    promoPrice: 64.99,
    promotionEndsAt: "2025-12-15",
  },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

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

export default function PromotionalSlabs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedFinishes, setSelectedFinishes] = useState<SlabFinish[]>([]);
  const [selectedThicknesses, setSelectedThicknesses] = useState<
    SlabThickness[]
  >([]);
  const [slabs] = useState<PromotionalSlab[]>(MOCK_PROMOTIONAL_SLABS);

  // TODO: Fetch real data from API
  // useEffect(() => {
  //   async function fetchPromotionalSlabs() {
  //     const res = await fetch('/api/slabs/promotional');
  //     const data = await res.json();
  //     setSlabs(data);
  //   }
  //   fetchPromotionalSlabs();
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
    return slabs.filter((slab) => {
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

      return (
        matchesSearch && matchesProvider && matchesFinish && matchesThickness
      );
    });
  }, [
    slabs,
    searchTerm,
    selectedProviders,
    selectedFinishes,
    selectedThicknesses,
  ]);

  const calculateDiscount = (listPrice: number, promoPrice: number) => {
    return Math.round(((listPrice - promoPrice) / listPrice) * 100);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedProviders([]);
    setSelectedFinishes([]);
    setSelectedThicknesses([]);
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    selectedProviders.length > 0 ||
    selectedFinishes.length > 0 ||
    selectedThicknesses.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Promotional Slabs
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View current promotions and special pricing on slab materials.
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

      {/* Results */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Brand
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
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  List Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Promo Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Discount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ends
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSlabs.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    No promotional slabs found matching your filters.
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
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 text-right line-through">
                      {formatCurrency(slab.listPrice)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-green-600 dark:text-green-400 text-right">
                      {formatCurrency(slab.promoPrice)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                        -{calculateDiscount(slab.listPrice, slab.promoPrice)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {slab.promotionEndsAt
                        ? new Date(slab.promotionEndsAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredSlabs.length} of {slabs.length} promotional slabs
      </div>
    </div>
  );
}

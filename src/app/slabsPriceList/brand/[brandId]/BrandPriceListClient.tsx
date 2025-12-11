"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import type { SlabBrandConfig, Slab } from "@prisma/client";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";

type SerializedSlab = Omit<
  Slab,
  "widthIn" | "heightIn" | "providerPrice" | "finalPrice"
> & {
  widthIn: number;
  heightIn: number;
  providerPrice: number;
  finalPrice: number;
};

type SerializedBrand = Omit<
  SlabBrandConfig,
  "profitFactor" | "taxRate" | "deliveryFee" | "discount"
> & {
  profitFactor: number;
  taxRate: number;
  deliveryFee: number;
  discount: number;
  slabs: SerializedSlab[];
};

type FilterOptions = {
  series: string[];
  finishes: string[];
  thicknesses: string[];
  statuses: string[];
  sizes: string[];
};

type Props = {
  brand: SerializedBrand;
  filterOptions: FilterOptions;
};

// Helper functions
function formatFinish(finish: string): string {
  return finish
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatThickness(thickness: string): string {
  switch (thickness) {
    case "TWO_CM":
      return "2cm";
    case "THREE_CM":
      return "3cm";
    case "EIGHT_MM":
      return "8mm";
    case "TWELVE_MM":
      return "12mm";
    default:
      return thickness;
  }
}

function formatSize(heightIn: number, widthIn: number): string {
  return `${Math.round(heightIn)} x ${Math.round(widthIn)} in`;
}

function calculateSquareFeet(heightIn: number, widthIn: number): string {
  const sqFt = (heightIn * widthIn) / 144; // Convert square inches to square feet
  return sqFt.toFixed(2);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function BrandPriceListClient({ brand, filterOptions }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [selectedFinishes, setSelectedFinishes] = useState<string[]>([]);
  const [selectedThicknesses, setSelectedThicknesses] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);

  const filteredSlabs = useMemo(() => {
    return brand.slabs.filter((slab) => {
      const series = slab.series ?? "";
      const finish = formatFinish(slab.finish);
      const thickness = formatThickness(slab.thickness);
      const size = formatSize(slab.heightIn, slab.widthIn);
      const status = slab.status;

      // TEXT SEARCH: color, series, or code (case-insensitive)
      const term = searchTerm.trim().toLowerCase();
      if (term) {
        const haystack = `${slab.color} ${series} ${
          slab.providerCode ?? ""
        }`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      // SERIES FILTER
      if (selectedSeries.length > 0 && !selectedSeries.includes(series)) {
        return false;
      }

      // FINISH FILTER
      if (selectedFinishes.length > 0 && !selectedFinishes.includes(finish)) {
        return false;
      }

      // THICKNESS FILTER
      if (
        selectedThicknesses.length > 0 &&
        !selectedThicknesses.includes(thickness)
      ) {
        return false;
      }

      // STATUS FILTER
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(status)) {
        return false;
      }

      // SIZE FILTER
      if (selectedSizes.length > 0 && !selectedSizes.includes(size)) {
        return false;
      }

      return true;
    });
  }, [
    brand.slabs,
    searchTerm,
    selectedSeries,
    selectedFinishes,
    selectedThicknesses,
    selectedStatuses,
    selectedSizes,
  ]);

  const clearFilters = () => {
    setSelectedSeries([]);
    setSelectedFinishes([]);
    setSelectedThicknesses([]);
    setSelectedStatuses([]);
    setSelectedSizes([]);
  };

  const hasActiveFilters =
    selectedSeries.length > 0 ||
    selectedFinishes.length > 0 ||
    selectedThicknesses.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedSizes.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/slabsPriceList"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Overview
        </Link>
        <div className="flex items-center gap-4">
          {brand.logoUrl && (
            <img
              src={brand.logoUrl}
              alt={`${brand.name} logo`}
              className="h-16 w-auto object-contain"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {brand.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              View current pricing for this provider.
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="sticky top-16 z-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 shadow-sm">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by color, series, or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterMultiSelect
            label="Series"
            options={filterOptions.series}
            selected={selectedSeries}
            onChange={setSelectedSeries}
          />
          <FilterMultiSelect
            label="Finish"
            options={filterOptions.finishes}
            selected={selectedFinishes}
            onChange={setSelectedFinishes}
          />
          <FilterMultiSelect
            label="Size"
            options={filterOptions.sizes}
            selected={selectedSizes}
            onChange={setSelectedSizes}
          />
          <FilterMultiSelect
            label="Thickness"
            options={filterOptions.thicknesses}
            selected={selectedThicknesses}
            onChange={setSelectedThicknesses}
          />
          <FilterMultiSelect
            label="Status"
            options={filterOptions.statuses}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
          />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Series
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Color
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Finish
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  H x W
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  SF
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Thickness
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
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
                    {searchTerm
                      ? "No slabs found matching your search."
                      : "No slabs available for this brand."}
                  </td>
                </tr>
              ) : (
                filteredSlabs.map((slab) => {
                  return (
                    <tr
                      key={slab.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {slab.series || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {slab.providerCode || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {slab.color}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {formatFinish(slab.finish)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {formatSize(slab.heightIn, slab.widthIn)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {calculateSquareFeet(slab.heightIn, slab.widthIn)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {formatThickness(slab.thickness)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(slab.finalPrice)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            slab.status === "AVAILABLE"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                              : slab.status === "DISCONTINUED"
                              ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {slab.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredSlabs.length} of {brand.slabs.length} slabs
      </div>
    </div>
  );
}

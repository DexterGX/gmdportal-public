"use client";
import React from "react";
import { Search, X } from "lucide-react";

export default function StockFilters({
  query,
  setQuery,
  category,
  setCategory,
  categories,
}: {
  query: string;
  setQuery: (v: string) => void;
  category?: string;
  setCategory: (v?: string) => void;
  categories: string[];
}) {
  const hasActiveFilters = query !== "" || category !== undefined;

  const clearFilters = () => {
    setQuery("");
    setCategory(undefined);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4 mb-6">
      {/* Search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Category Filter */}
        <div>
          <select
            value={category ?? ""}
            onChange={(e) => setCategory(e.target.value || undefined)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

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
  );
}

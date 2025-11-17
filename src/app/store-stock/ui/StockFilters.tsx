"use client";
import React from "react";

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
  return (
    <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="flex items-center gap-2 w-full md:w-1/2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items..."
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div className="flex items-center gap-2">
        <select
          value={category ?? ""}
          onChange={(e) => setCategory(e.target.value || undefined)}
          className="px-3 py-2 border rounded"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setQuery("");
            setCategory(undefined);
          }}
          className="px-3 py-2 bg-gray-100 rounded"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

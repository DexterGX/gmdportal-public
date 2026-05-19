"use client";

import { useEffect, useState } from "react";
import SinkBrandCard from "./SinkBrandCard";

type SinkBrandOverview = {
  id: string;
  name: string;
  logoUrl: string | null;
  availableCount: number;
};

export default function SinksOverviewClient() {
  const [brands, setBrands] = useState<SinkBrandOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchBrands() {
      try {
        setLoading(true);
        const res = await fetch("/api/sinks/brands-overview");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || "Failed to load sink brands");
        }
        setBrands(Array.isArray(json?.brands) ? json.brands : []);
      } catch (err: any) {
        setError(err?.message || "Failed to load sink brands");
      } finally {
        setLoading(false);
      }
    }

    fetchBrands();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Overview
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Select a sink provider to view pricing.
        </p>
      </div>

      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">
              Loading brands...
            </span>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {!loading && !error && brands.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No brands configured yet. Please add brands in Brand Settings to get
            started.
          </p>
        </div>
      )}

      {!loading && !error && brands.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {brands.map((brand) => (
            <SinkBrandCard
              key={brand.id}
              id={brand.id}
              name={brand.name}
              logoUrl={brand.logoUrl}
              availableCount={brand.availableCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}

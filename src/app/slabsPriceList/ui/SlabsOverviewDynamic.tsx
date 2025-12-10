"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type BrandWithColors = {
  id: string;
  name: string;
  logoUrl: string | null;
  colorCount: number;
};

export default function SlabsOverviewDynamic() {
  const [brands, setBrands] = useState<BrandWithColors[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchBrands() {
      try {
        setLoading(true);
        const res = await fetch("/api/slabs/brands-overview");
        if (!res.ok) throw new Error("Failed to fetch brands");
        const data = await res.json();
        setBrands(data.brands || []);
        setError("");
      } catch (err: any) {
        console.error("Error fetching brands:", err);
        setError(err.message || "Failed to load brands");
      } finally {
        setLoading(false);
      }
    }
    fetchBrands();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Overview
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Select a slab provider to view pricing.
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">
              Loading brands...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Overview
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Select a slab provider to view pricing.
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Overview
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Select a slab provider to view pricing.
        </p>
      </div>

      {brands.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No brands configured yet. Please add brands in Brand Settings to get
            started.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={`/slabsPriceList/brand/${brand.id}`}
              className="flex items-center gap-6 rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-8 py-6 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-gray-600 transition"
            >
              {/* Logo / Avatar */}
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-50 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                {brand.logoUrl ? (
                  <img
                    src={brand.logoUrl}
                    alt={`${brand.name} logo`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-3xl font-semibold text-slate-500 dark:text-gray-400">
                    {brand.name?.charAt(0).toUpperCase() ?? "?"}
                  </span>
                )}
              </div>

              {/* Text */}
              <div className="flex flex-col">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-gray-100">
                  {brand.name}
                </h3>
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-sky-600 dark:text-blue-400 hover:text-sky-700 dark:hover:text-blue-300 text-left"
                >
                  {brand.colorCount} colors available
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

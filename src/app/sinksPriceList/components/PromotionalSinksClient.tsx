"use client";

import { useEffect, useState } from "react";

type SinkRow = {
  id: string;
  brandName: string;
  model: string;
  description: string | null;
  dimensions: string;
  listedPrice: number;
  promotionalPrice: number | null;
  finalPrice: number;
  imageUrl: string | null;
};

function fmt(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function PromotionalSinksClient() {
  const [rows, setRows] = useState<SinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/sinks/promotional", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || "Failed to load promotional sinks");
        }
        setRows(Array.isArray(json?.sinks) ? json.sinks : []);
      } catch (err: any) {
        setError(err?.message || "Failed to load promotional sinks");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Promotional Sinks
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Current promotional sink offers.
        </p>
      </div>

      {loading && (
        <div className="text-sm text-gray-500">
          Loading promotional sinks...
        </div>
      )}
      {!loading && error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">Brand</th>
                  <th className="px-4 py-3 text-left">Model</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Dimensions</th>
                  <th className="px-4 py-3 text-left">Listed</th>
                  <th className="px-4 py-3 text-left">Promo</th>
                  <th className="px-4 py-3 text-left">Final</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-gray-100 dark:border-gray-700"
                  >
                    <td className="px-4 py-3">{row.brandName}</td>
                    <td className="px-4 py-3">{row.model}</td>
                    <td className="px-4 py-3">{row.description || "-"}</td>
                    <td className="px-4 py-3">{row.dimensions}</td>
                    <td className="px-4 py-3">{fmt(row.listedPrice)}</td>
                    <td className="px-4 py-3">
                      {row.promotionalPrice !== null
                        ? fmt(row.promotionalPrice)
                        : "-"}
                    </td>
                    <td className="px-4 py-3">{fmt(row.finalPrice)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-gray-500"
                      colSpan={7}
                    >
                      No promotional sinks found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

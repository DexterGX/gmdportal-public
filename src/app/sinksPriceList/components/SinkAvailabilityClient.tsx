"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

type SinkRow = {
  id: string;
  brandName: string;
  series: string | null;
  model: string;
  description: string | null;
  dimensions: string;
  finalPrice: number;
  status: "AVAILABLE" | "DISCONTINUED";
};

function fmt(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function SinkAvailabilityClient() {
  const [rows, setRows] = useState<SinkRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch("/api/sinks/availability", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      setRows(Array.isArray(json?.sinks) ? json.sinks : []);
      setLoading(false);
    }

    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return rows;
    }
    return rows.filter((row) => {
      const haystack =
        `${row.brandName} ${row.series || ""} ${row.model} ${row.description || ""} ${row.dimensions}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Availability
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Available sinks and current pricing.
        </p>
      </div>

      <div className="max-w-md relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by brand, series, model..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
        />
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading sinks...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">Brand</th>
                  <th className="px-4 py-3 text-left">Series</th>
                  <th className="px-4 py-3 text-left">Model</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Dimensions</th>
                  <th className="px-4 py-3 text-left">Final Price</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-gray-100 dark:border-gray-700"
                  >
                    <td className="px-4 py-3">{row.brandName}</td>
                    <td className="px-4 py-3">{row.series || "-"}</td>
                    <td className="px-4 py-3">{row.model}</td>
                    <td className="px-4 py-3">{row.description || "-"}</td>
                    <td className="px-4 py-3">{row.dimensions}</td>
                    <td className="px-4 py-3">{fmt(row.finalPrice)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-gray-500"
                      colSpan={6}
                    >
                      No sinks found.
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

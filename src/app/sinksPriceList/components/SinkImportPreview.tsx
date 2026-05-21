"use client";

import { useState } from "react";

type DiffPayload = {
  newSinks: Array<{
    brandName: string;
    series: string | null;
    model: string;
    description: string | null;
    dimensions: string;
    listedPrice: number;
    finalPrice: number; // Added finalPrice property
    status: string;
  }>;
  updatedSinks: Array<{
    id: string;
    model: string;
    dimensions: string;
    before: {
      series: string | null;
      listedPrice: number;
      finalPrice: number; // Ensure finalPrice is included here
      status: string;
      description: string | null;
    };
    after: {
      series: string | null;
      listedPrice: number;
      finalPrice: number; // Ensure finalPrice is included here
      status: string;
      description: string | null;
    };
  }>;
  discontinuedSinks: Array<{
    id: string;
    series: string | null;
    model: string;
    description: string | null;
    dimensions: string;
    listedPrice: number;
    finalPrice: number; // Added finalPrice property
    status: string;
  }>;
};

export default function SinkImportPreview({
  diff,
  onBack,
  onApply,
  applying,
}: {
  diff: DiffPayload;
  onBack: () => void;
  onApply: () => Promise<void>;
  applying: boolean;
}) {
  const [tab, setTab] = useState<"new" | "updated" | "discontinued">("new");

  const formatCurrencyChange = (before: number, after: number) => {
    const beforeText = `$${before.toFixed(2)}`;
    const afterText = `$${after.toFixed(2)}`;
    return beforeText === afterText ? beforeText : `${beforeText} -> ${afterText}`;
  };

  const formatTextChange = (before: string, after: string) => {
    const beforeText = before.trim() || "-";
    const afterText = after.trim() || "-";
    return beforeText === afterText ? beforeText : `${beforeText} -> ${afterText}`;
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Import Preview
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {diff.newSinks.length} new, {diff.updatedSinks.length} updated,{" "}
            {diff.discontinuedSinks.length} removed
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => void onApply()}
            disabled={applying}
            className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm disabled:opacity-50"
          >
            {applying ? "Applying..." : "Apply Changes"}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700 flex">
          <button
            type="button"
            onClick={() => setTab("new")}
            className={`px-4 py-2 text-sm ${tab === "new" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          >
            New ({diff.newSinks.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("updated")}
            className={`px-4 py-2 text-sm ${tab === "updated" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          >
            Updated ({diff.updatedSinks.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("discontinued")}
            className={`px-4 py-2 text-sm ${tab === "discontinued" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500"}`}
          >
            Removed ({diff.discontinuedSinks.length})
          </button>
        </div>

        <div className="p-4 text-sm">
          <table className="table-auto w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2">Series</th>
                <th className="px-4 py-2">Model</th>
                <th className="px-4 py-2">Dimensions</th>
                <th className="px-4 py-2">Listed Price</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Final Price</th>
              </tr>
            </thead>
            <tbody>
              {tab === "new" &&
                diff.newSinks.map((row, idx) => (
                  <tr key={`${row.model}-${idx}`} className="border-b">
                    <td className="px-4 py-2">{row.series || "-"}</td>
                    <td className="px-4 py-2">{row.model}</td>
                    <td className="px-4 py-2">{row.dimensions}</td>
                    <td className="px-4 py-2">${row.listedPrice.toFixed(2)}</td>
                    <td className="px-4 py-2">{row.status}</td>
                    <td className="px-4 py-2">${row.finalPrice.toFixed(2)}</td>
                  </tr>
                ))}
              {tab === "updated" &&
                diff.updatedSinks.map((row, idx) => (
                  <tr
                    key={`updated-${row.id}-${row.model}-${row.dimensions}-${idx}`}
                    className="border-b"
                  >
                    <td className="px-4 py-2">
                      {formatTextChange(row.before.series || "", row.after.series || "")}
                    </td>
                    <td className="px-4 py-2">{row.model}</td>
                    <td className="px-4 py-2">{row.dimensions}</td>
                    <td className="px-4 py-2">
                      {formatCurrencyChange(
                        Number(row.before.listedPrice ?? 0),
                        Number(row.after.listedPrice ?? 0),
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {formatTextChange(row.before.status || "", row.after.status || "")}
                    </td>
                    <td className="px-4 py-2">
                      {formatCurrencyChange(
                        Number(row.before.finalPrice ?? 0),
                        Number(row.after.finalPrice ?? 0),
                      )}
                    </td>
                  </tr>
                ))}
              {tab === "discontinued" &&
                diff.discontinuedSinks.map((row, idx) => (
                  <tr
                    key={`removed-${row.id}-${row.model}-${row.dimensions}-${idx}`}
                    className="border-b"
                  >
                    <td className="px-4 py-2">{row.series || "-"}</td>
                    <td className="px-4 py-2">{row.model}</td>
                    <td className="px-4 py-2">{row.dimensions}</td>
                    <td className="px-4 py-2">${row.listedPrice.toFixed(2)}</td>
                    <td className="px-4 py-2">{row.status}</td>
                    <td className="px-4 py-2">${row.finalPrice.toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

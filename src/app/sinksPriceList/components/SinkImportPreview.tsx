"use client";

import { useState } from "react";

type DiffPayload = {
  newSinks: Array<{
    brandName: string;
    model: string;
    description: string | null;
    dimensions: string;
    listedPrice: number;
    status: string;
  }>;
  updatedSinks: Array<{
    id: string;
    model: string;
    dimensions: string;
    before: { listedPrice: number; status: string; description: string | null };
    after: { listedPrice: number; status: string; description: string | null };
  }>;
  discontinuedSinks: Array<{
    id: string;
    model: string;
    dimensions: string;
    listedPrice: number;
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

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Import Preview
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {diff.newSinks.length} new, {diff.updatedSinks.length} updated,{" "}
            {diff.discontinuedSinks.length} discontinued
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
            Discontinued ({diff.discontinuedSinks.length})
          </button>
        </div>

        <div className="p-4 text-sm">
          {tab === "new" &&
            diff.newSinks.map((row, idx) => (
              <div
                key={`${row.model}-${idx}`}
                className="py-2 border-b border-gray-100 dark:border-gray-700"
              >
                {row.model} | {row.dimensions} | ${row.listedPrice.toFixed(2)}
              </div>
            ))}
          {tab === "updated" &&
            diff.updatedSinks.map((row) => (
              <div
                key={row.id}
                className="py-2 border-b border-gray-100 dark:border-gray-700"
              >
                {row.model} | {row.dimensions} | $
                {row.before.listedPrice.toFixed(2)} {"->"} $
                {row.after.listedPrice.toFixed(2)}
              </div>
            ))}
          {tab === "discontinued" &&
            diff.discontinuedSinks.map((row) => (
              <div
                key={row.id}
                className="py-2 border-b border-gray-100 dark:border-gray-700"
              >
                {row.model} | {row.dimensions} | currently {row.status}
              </div>
            ))}

          {tab === "new" && diff.newSinks.length === 0 && (
            <p className="text-gray-500">No new sinks.</p>
          )}
          {tab === "updated" && diff.updatedSinks.length === 0 && (
            <p className="text-gray-500">No updated sinks.</p>
          )}
          {tab === "discontinued" && diff.discontinuedSinks.length === 0 && (
            <p className="text-gray-500">No discontinued sinks.</p>
          )}
        </div>
      </div>
    </div>
  );
}

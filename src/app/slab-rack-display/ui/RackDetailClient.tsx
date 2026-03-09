"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SlabActions from "./SlabActions";
import type { SlabBayState } from "./mockData";
import {
  fetchStateFromDb,
  getRackById,
  getSlabsByRack,
  loadState,
  saveState,
} from "./storage";

export default function RackDetailClient({ userName }: { userName: string }) {
  const params = useParams();
  const router = useRouter();
  const rackId = String(params?.rackId ?? "").toLowerCase();
  const [state, setState] = useState<SlabBayState>(() => loadState());

  useEffect(() => {
    let active = true;
    fetchStateFromDb().then((data) => {
      if (!active || !data) return;
      setState(data);
      saveState(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const rack = useMemo(() => getRackById(state, rackId), [state, rackId]);
  const slabs = useMemo(
    () => (rack ? getSlabsByRack(state, rack.id) : []),
    [state, rack],
  );

  if (!rack) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
          Rack not found
        </h1>
        <button
          type="button"
          onClick={() => router.push("/slab-rack-display")}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to SlabBay
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push("/slab-rack-display")}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            ← Back to SlabBay
          </button>
          <h1 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-gray-200">
            Rack {rack.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {slabs.length}/{rack.capacity} slabs in rack
          </p>
          {rack.note && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {rack.note}
            </p>
          )}
        </div>
        <SlabActions
          state={state}
          onUpdate={setState}
          defaultRackId={rack.id}
          userName={userName}
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-4">Slab ID</th>
                <th className="py-2 pr-4">Scanner ID</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Thickness</th>
                <th className="py-2 pr-4">Size</th>
                <th className="py-2 pr-4">Client</th>
                <th className="py-2 pr-4">Date Added</th>
              </tr>
            </thead>
            <tbody>
              {slabs.map((slab) => (
                <tr
                  key={slab.id}
                  className="border-t border-gray-100 dark:border-gray-800"
                >
                  <td className="py-3 pr-4 font-medium text-gray-800 dark:text-gray-100">
                    {slab.id}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {slab.scannerId || "-"}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {slab.name}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {slab.type}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {slab.thickness}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {slab.size}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {slab.clientName}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {slab.createdAt}
                  </td>
                </tr>
              ))}
              {slabs.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-6 text-center text-gray-500 dark:text-gray-400"
                  >
                    No slabs in this rack yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

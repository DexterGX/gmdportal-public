"use client";

import { useEffect, useMemo, useState } from "react";
import type { SlabBayState } from "./mockData";
import { fetchStateFromDb, loadState, saveState } from "./storage";

export default function InventoryClient() {
  const [state, setState] = useState<SlabBayState>(() => loadState());
  const [searchTerm, setSearchTerm] = useState("");
  const [rackFilter, setRackFilter] = useState("all");

  const racks = useMemo(
    () =>
      state.racks
        .map((rack) => rack.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [state.racks],
  );

  const rows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return state.slabs.filter((slab) => {
      const matchesRack =
        rackFilter === "all" ? true : slab.rackId === rackFilter.toLowerCase();
      const matchesTerm = term
        ? slab.name.toLowerCase().includes(term) ||
          slab.clientName.toLowerCase().includes(term) ||
          (slab.scannerId || "").toLowerCase().includes(term) ||
          slab.id.toLowerCase().includes(term)
        : true;
      return matchesRack && matchesTerm;
    });
  }, [state.slabs, rackFilter, searchTerm]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
          Slab Inventory
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Full list of slabs in the gallery with scanner IDs and rack locations.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by slab, client, or scanner ID"
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
          <select
            value={rackFilter}
            onChange={(event) => setRackFilter(event.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          >
            <option value="all">All racks</option>
            {racks.map((rack) => (
              <option key={rack} value={rack}>
                {rack}
              </option>
            ))}
          </select>
          <div className="flex items-center justify-end text-sm text-gray-500 dark:text-gray-400">
            Showing {rows.length} of {state.slabs.length}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-4">Scanner ID</th>
                <th className="py-2 pr-4">Slab ID</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Thickness</th>
                <th className="py-2 pr-4">Size</th>
                <th className="py-2 pr-4">Client</th>
                <th className="py-2 pr-4">Rack</th>
                <th className="py-2 pr-4">Date Added</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((slab) => (
                <tr
                  key={slab.id}
                  className="border-t border-gray-100 dark:border-gray-800"
                >
                  <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                    {slab.scannerId || "-"}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {slab.id}
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
                    {slab.rackId.toUpperCase()}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {slab.createdAt}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-6 text-center text-gray-500 dark:text-gray-400"
                  >
                    No slabs found.
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

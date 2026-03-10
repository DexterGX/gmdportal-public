"use client";

import { useEffect, useMemo, useState } from "react";
import type { SlabBayState } from "./mockData";
import { fetchStateFromDb, loadState, saveState } from "./storage";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";

export default function InventoryClient() {
  const [state, setState] = useState<SlabBayState>(() => loadState());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRacks, setSelectedRacks] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedThicknesses, setSelectedThicknesses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const formatTimestamp = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const datePart = date.toLocaleDateString();
    const timePart = date.toLocaleTimeString();
    return { datePart, timePart };
  };

  const racks = useMemo(
    () =>
      state.racks
        .map((rack) => rack.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [state.racks],
  );

  const types = useMemo(
    () =>
      Array.from(new Set(state.slabs.map((slab) => slab.type))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [state.slabs],
  );

  const thicknesses = useMemo(
    () =>
      Array.from(new Set(state.slabs.map((slab) => slab.thickness))).sort(
        (a, b) => a.localeCompare(b, undefined, { numeric: true }),
      ),
    [state.slabs],
  );

  const rows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const rackIds = selectedRacks.map((rack) => rack.toLowerCase());
    return state.slabs
      .filter((slab) => {
        const matchesRack =
          rackIds.length === 0 ? true : rackIds.includes(slab.rackId);
        const matchesType =
          selectedTypes.length === 0 ? true : selectedTypes.includes(slab.type);
        const matchesThickness =
          selectedThicknesses.length === 0
            ? true
            : selectedThicknesses.includes(slab.thickness);
        const matchesTerm = term
          ? slab.name.toLowerCase().includes(term) ||
            slab.clientName.toLowerCase().includes(term) ||
            (slab.scannerId || "").toLowerCase().includes(term) ||
            slab.id.toLowerCase().includes(term)
          : true;
        return matchesRack && matchesType && matchesThickness && matchesTerm;
      })
      .sort((a, b) => {
        const rackCompare = a.rackId.localeCompare(b.rackId, undefined, {
          numeric: true,
        });
        if (rackCompare !== 0) return rackCompare;
        return a.clientName.localeCompare(b.clientName, undefined, {
          numeric: true,
        });
      });
  }, [
    state.slabs,
    selectedRacks,
    selectedTypes,
    selectedThicknesses,
    searchTerm,
  ]);

  useEffect(() => {
    let active = true;
    const load = () => {
      if (!hasLoaded) {
        setIsLoading(true);
      }
      fetchStateFromDb()
        .then((data) => {
          if (!active || !data) return;
          setState(data);
          saveState(data);
        })
        .finally(() => {
          if (!active) return;
          setHasLoaded(true);
          setIsLoading(false);
        });
    };

    load();
    const intervalId = window.setInterval(load, 10000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [hasLoaded]);

  const handlePrint = () => {
    setTimeout(() => window.print(), 50);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedRacks([]);
    setSelectedTypes([]);
    setSelectedThicknesses([]);
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
          Slab Inventory
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Full list of slabs in the gallery with scanner IDs and rack locations.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by slab, client, or scanner ID"
            className="min-w-[240px] flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
          <FilterMultiSelect
            label="Racks"
            options={racks}
            selected={selectedRacks}
            onChange={setSelectedRacks}
          />
          <FilterMultiSelect
            label="Type"
            options={types}
            selected={selectedTypes}
            onChange={setSelectedTypes}
          />
          <FilterMultiSelect
            label="Thickness"
            options={thicknesses}
            selected={selectedThicknesses}
            onChange={setSelectedThicknesses}
          />
          <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
            Showing {rows.length} of {state.slabs.length}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Print inventory
          </button>
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Clear filters
          </button>
        </div>
      </div>

      <div
        id="print-area"
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 print:shadow-none print:bg-white"
      >
        <div className="hidden print:block mb-3">
          <h1 className="text-2xl font-semibold text-gray-800">
            Slab Inventory
          </h1>
        </div>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading inventory...
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm print-inventory-table">
              <thead>
                <tr className="hidden print:table-row print-spacer-row">
                  <th colSpan={10} aria-hidden="true" />
                </tr>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-2 pr-4">Scanner ID</th>
                  <th className="py-2 pr-4">Slab ID</th>
                  <th className="py-2 pr-4">Batch</th>
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
                      {slab.batchIndex && slab.batchSize
                        ? `${slab.batchIndex}/${slab.batchSize}`
                        : "-"}
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
                      {(() => {
                        const formatted = formatTimestamp(slab.createdAt);
                        if (typeof formatted === "string") return formatted;
                        return (
                          <div>
                            <div>{formatted.datePart}</div>
                            <div>{formatted.timePart}</div>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      No slabs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

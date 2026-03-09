"use client";

import { useEffect, useMemo, useState } from "react";
import type { SlabBayState } from "./mockData";
import { fetchStateFromDb, loadState, saveState } from "./storage";

const formatType = (type: "entry" | "exit" | "move") => {
  if (type === "entry") return "Entry";
  if (type === "exit") return "Exit";
  return "Move";
};

export default function HistoryClient() {
  const [state, setState] = useState<SlabBayState>(() => loadState());
  const [mounted, setMounted] = useState(false);
  const [clientFilter, setClientFilter] = useState("");
  const [slabFilter, setSlabFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [printMode, setPrintMode] = useState<"filtered" | "all">("filtered");

  const rows = useMemo(() => {
    return state.history.filter((entry) => {
      const matchesClient = clientFilter
        ? entry.clientName.toLowerCase().includes(clientFilter.toLowerCase())
        : true;
      const matchesSlab = slabFilter
        ? entry.slabName.toLowerCase().includes(slabFilter.toLowerCase()) ||
          entry.slabId.toLowerCase().includes(slabFilter.toLowerCase()) ||
          (entry.slabScannerId
            ? entry.slabScannerId
                .toLowerCase()
                .includes(slabFilter.toLowerCase())
            : false)
        : true;
      const matchesUser = userFilter
        ? entry.userName.toLowerCase().includes(userFilter.toLowerCase())
        : true;
      const matchesDate = dateFilter
        ? entry.timestamp.toLowerCase().includes(dateFilter.toLowerCase())
        : true;
      const matchesAction =
        actionFilter === "all" ? true : entry.type === actionFilter;

      return (
        matchesClient &&
        matchesSlab &&
        matchesUser &&
        matchesDate &&
        matchesAction
      );
    });
  }, [
    state.history,
    clientFilter,
    slabFilter,
    userFilter,
    dateFilter,
    actionFilter,
  ]);

  const displayRows = printMode === "all" ? state.history : rows;

  const handlePrint = (mode: "filtered" | "all") => {
    setPrintMode(mode);
    setTimeout(() => window.print(), 50);
  };

  useEffect(() => {
    setMounted(true);
    const resetMode = () => setPrintMode("filtered");
    window.addEventListener("afterprint", resetMode);
    return () => window.removeEventListener("afterprint", resetMode);
  }, []);

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

  if (!mounted) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
          Slab History Log
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Track slab entry, exits, and moves with user/client details.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 print:hidden">
        <div className="grid gap-3 md:grid-cols-5">
          <input
            value={clientFilter}
            onChange={(event) => setClientFilter(event.target.value)}
            placeholder="Filter by client"
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
          <input
            value={slabFilter}
            onChange={(event) => setSlabFilter(event.target.value)}
            placeholder="Filter by slab"
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
          <input
            value={userFilter}
            onChange={(event) => setUserFilter(event.target.value)}
            placeholder="Filter by user"
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
          <input
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            placeholder="Filter by date"
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          >
            <option value="all">All actions</option>
            <option value="entry">Entry</option>
            <option value="move">Move</option>
            <option value="exit">Exit</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handlePrint("filtered")}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Print filtered
          </button>
          <button
            type="button"
            onClick={() => handlePrint("all")}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Print full inventory
          </button>
        </div>
      </div>

      <div
        id="print-area"
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 print:shadow-none print:bg-white"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Slab</th>
                <th className="py-2 pr-4">Scanner ID</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Client</th>
                <th className="py-2 pr-4">From</th>
                <th className="py-2 pr-4">To</th>
                <th className="py-2 pr-4">Exit Notes</th>
                <th className="py-2 pr-4">User</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-t border-gray-100 dark:border-gray-800"
                >
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {entry.timestamp}
                  </td>
                  <td className="py-3 pr-4 font-medium text-gray-800 dark:text-gray-100">
                    {formatType(entry.type)}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {entry.slabName}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {entry.slabScannerId || "-"}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {entry.slabType}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {entry.clientName}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {entry.fromRack ? `${entry.fromRack}` : "-"}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {entry.toRack ? `${entry.toRack}` : "-"}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {entry.exitNote || "-"}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {entry.userName}
                  </td>
                </tr>
              ))}
              {displayRows.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="py-6 text-center text-gray-500 dark:text-gray-400"
                  >
                    No history entries yet.
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

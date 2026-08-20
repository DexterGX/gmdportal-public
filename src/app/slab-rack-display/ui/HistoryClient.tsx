"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { SlabBayState } from "./mockData";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";
import {
  fetchStateFromDb,
  getRackLoad,
  loadState,
  recoverExitedSlab,
  splitClientName,
} from "./storage";

type HistorySortKey =
  | "date"
  | "action"
  | "slabId"
  | "slab"
  | "scannerId"
  | "batch"
  | "brand"
  | "finish"
  | "thickness"
  | "size"
  | "type"
  | "client"
  | "from"
  | "to"
  | "jobId"
  | "notes"
  | "user";

type SortDirection = "asc" | "desc";

const SLAB_VIEW_LICENSE = "532b5c05af7b036ff8a0200d0c8dc6da";
const buildSlabViewUrl = (scannerId: string) =>
  `https://fusiondrivecloud.com/slabview/?license=${SLAB_VIEW_LICENSE}&SlabID=${encodeURIComponent(
    scannerId,
  )}`;

const formatType = (
  type: "entry" | "exit" | "move" | "change" | "recovery",
) => {
  if (type === "entry") return "Entry";
  if (type === "exit") return "Exit";
  if (type === "change") return "Change";
  if (type === "recovery") return "Recovery";
  return "Move";
};

const formatHistoryTimestamp = (value: string) => {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      datePart: parsed.toLocaleDateString(),
      timePart: parsed.toLocaleTimeString(),
    };
  }

  const [datePart, ...rest] = value.split(",");
  return {
    datePart: (datePart || value).trim(),
    timePart: rest.join(",").trim(),
  };
};

export default function HistoryClient({ userName }: { userName: string }) {
  const rowStorageKey = "slabbay:last-row:history";
  // Captured once when the page loads so the "Printed by" line in the print
  // header reflects when this log was generated/viewed.
  const printedAt = useMemo(() => new Date(), []);
  const [state, setState] = useState<SlabBayState>(() => loadState());
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [clientFilter, setClientFilter] = useState("");
  const [slabFilter, setSlabFilter] = useState("");
  const [scannerIdFilter, setScannerIdFilter] = useState("");
  const [notesFilter, setNotesFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [printMode, setPrintMode] = useState<"filtered" | "all">("filtered");
  const [sortKey, setSortKey] = useState<HistorySortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedExitHistoryId, setSelectedExitHistoryId] = useState<
    string | null
  >(null);
  const [recoveryRackId, setRecoveryRackId] = useState("");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [lastClickedHistoryId, setLastClickedHistoryId] = useState("");
  const [clientSubtitleByName, setClientSubtitleByName] = useState<
    Record<string, string | null>
  >({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(rowStorageKey);
    setLastClickedHistoryId(stored || "");
  }, []);

  const brandOptions = useMemo(
    () =>
      Array.from(
        new Set(
          state.history.map((entry) => entry.brand || "").filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    [state.history],
  );

  const rows = useMemo(() => {
    return state.history.filter((entry) => {
      const { clientName, originalClientName } = splitClientName(
        entry.clientName,
      );
      const combinedNotes = [entry.entryNote, entry.slabNotes, entry.exitNote]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesClient = clientFilter
        ? clientName.toLowerCase().includes(clientFilter.toLowerCase()) ||
          (originalClientName || "")
            .toLowerCase()
            .includes(clientFilter.toLowerCase())
        : true;
      const matchesSlab = slabFilter
        ? entry.slabName.toLowerCase().includes(slabFilter.toLowerCase()) ||
          entry.slabId.toLowerCase().includes(slabFilter.toLowerCase()) ||
          (entry.brand || "")
            .toLowerCase()
            .includes(slabFilter.toLowerCase()) ||
          (entry.finish || "")
            .toLowerCase()
            .includes(slabFilter.toLowerCase()) ||
          (entry.jobId || "")
            .toLowerCase()
            .includes(slabFilter.toLowerCase()) ||
          (entry.slabSize || "")
            .toLowerCase()
            .includes(slabFilter.toLowerCase()) ||
          (entry.slabThickness || "")
            .toLowerCase()
            .includes(slabFilter.toLowerCase()) ||
          (entry.slabScannerId
            ? entry.slabScannerId
                .toLowerCase()
                .includes(slabFilter.toLowerCase())
            : false)
        : true;
      const matchesUser = scannerIdFilter
        ? (entry.slabScannerId || "")
            .toLowerCase()
            .includes(scannerIdFilter.toLowerCase())
        : true;
      const matchesNotes = notesFilter
        ? combinedNotes.includes(notesFilter.toLowerCase())
        : true;
      const matchesDate = dateFilter
        ? entry.timestamp.toLowerCase().includes(dateFilter.toLowerCase())
        : true;
      const matchesBrand =
        selectedBrands.length === 0
          ? true
          : selectedBrands.includes(entry.brand || "");
      const matchesAction =
        actionFilter === "all" ? true : entry.type === actionFilter;

      return (
        matchesClient &&
        matchesSlab &&
        matchesUser &&
        matchesNotes &&
        matchesDate &&
        matchesBrand &&
        matchesAction
      );
    });
  }, [
    state.history,
    clientFilter,
    slabFilter,
    scannerIdFilter,
    notesFilter,
    dateFilter,
    selectedBrands,
    actionFilter,
  ]);

  useEffect(() => {
    const clientNames = Array.from(
      new Set(
        state.history
          .map((entry) => splitClientName(entry.clientName).clientName.trim())
          .filter(Boolean),
      ),
    );

    if (clientNames.length === 0) {
      setClientSubtitleByName({});
      return;
    }

    let active = true;
    fetch("/api/slab-rack-display/client-subtitles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: clientNames }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!active) return;
        const subtitles =
          payload && typeof payload === "object" && payload.subtitles
            ? (payload.subtitles as Record<string, string | null>)
            : {};
        setClientSubtitleByName(subtitles);
      })
      .catch(() => {
        if (!active) return;
        setClientSubtitleByName({});
      });

    return () => {
      active = false;
    };
  }, [state.history]);

  const compareValues = (
    left: string | number,
    right: string | number,
    direction: SortDirection,
    numeric = false,
  ) => {
    const result = numeric
      ? Number(left) - Number(right)
      : String(left).localeCompare(String(right), undefined, {
          numeric: true,
          sensitivity: "base",
        });
    return direction === "asc" ? result : -result;
  };

  const handleSort = (key: HistorySortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "date" ? "desc" : "asc");
  };

  const renderSortLabel = (key: HistorySortKey, label: string) => {
    const indicator =
      sortKey === key ? (sortDirection === "asc" ? " ▲" : " ▼") : "";
    return `${label}${indicator}`;
  };

  // For a combined header (e.g. "Finish / Thickness / Size"), clicking
  // cycles: field 1 asc -> field 1 desc -> field 2 asc -> field 2 desc ->
  // ... -> back to field 1 asc. Each sub-field keeps its own independent
  // sort behavior; only the active one shows an arrow.
  const handleCombinedSort = (fields: HistorySortKey[]) => {
    const currentIndex = fields.indexOf(sortKey);
    if (currentIndex === -1) {
      setSortKey(fields[0]);
      setSortDirection(fields[0] === "date" ? "desc" : "asc");
      return;
    }
    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }
    const nextIndex = (currentIndex + 1) % fields.length;
    setSortKey(fields[nextIndex]);
    setSortDirection("asc");
  };

  const renderCombinedSortLabel = (
    fields: { key: HistorySortKey; label: string }[],
  ) => (
    <>
      {fields.map((field, index) => {
        const isActive = sortKey === field.key;
        return (
          <span
            key={field.key}
            className={isActive ? "text-gray-700 dark:text-gray-100" : undefined}
          >
            {field.label}
            {isActive ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
            {index < fields.length - 1 ? " / " : ""}
          </span>
        );
      })}
    </>
  );

  const sortRows = (entries: typeof rows) =>
    [...entries].sort((a, b) => {
      const aClient = splitClientName(a.clientName).clientName;
      const bClient = splitClientName(b.clientName).clientName;
      const aNotes =
        `${a.entryNote || a.slabNotes || ""} ${a.exitNote || ""}`.trim();
      const bNotes =
        `${b.entryNote || b.slabNotes || ""} ${b.exitNote || ""}`.trim();
      const aBatch =
        a.batchIndex && a.batchSize ? `${a.batchIndex}/${a.batchSize}` : "";
      const bBatch =
        b.batchIndex && b.batchSize ? `${b.batchIndex}/${b.batchSize}` : "";

      switch (sortKey) {
        case "date": {
          const aTime = new Date(a.timestamp).getTime();
          const bTime = new Date(b.timestamp).getTime();
          if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) {
            return compareValues(aTime, bTime, sortDirection, true);
          }
          return compareValues(a.timestamp, b.timestamp, sortDirection);
        }
        case "action":
          return compareValues(
            formatType(a.type),
            formatType(b.type),
            sortDirection,
          );
        case "slabId":
          return compareValues(a.slabId, b.slabId, sortDirection);
        case "slab":
          return compareValues(a.slabName, b.slabName, sortDirection);
        case "scannerId":
          return compareValues(
            a.slabScannerId || "",
            b.slabScannerId || "",
            sortDirection,
          );
        case "batch":
          return compareValues(aBatch, bBatch, sortDirection);
        case "brand":
          return compareValues(a.brand || "", b.brand || "", sortDirection);
        case "finish":
          return compareValues(a.finish || "", b.finish || "", sortDirection);
        case "thickness":
          return compareValues(
            a.slabThickness || "",
            b.slabThickness || "",
            sortDirection,
          );
        case "size":
          return compareValues(
            a.slabSize || "",
            b.slabSize || "",
            sortDirection,
          );
        case "type":
          return compareValues(a.slabType, b.slabType, sortDirection);
        case "client":
          return compareValues(aClient, bClient, sortDirection);
        case "from":
          return compareValues(
            a.fromRack || "",
            b.fromRack || "",
            sortDirection,
          );
        case "to":
          return compareValues(a.toRack || "", b.toRack || "", sortDirection);
        case "jobId":
          return compareValues(a.jobId || "", b.jobId || "", sortDirection);
        case "notes":
          return compareValues(aNotes, bNotes, sortDirection);
        case "user":
          return compareValues(a.userName, b.userName, sortDirection);
        default:
          return 0;
      }
    });

  const displayRows =
    printMode === "all" ? sortRows(state.history) : sortRows(rows);

  const entryNoteBySlabId = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of state.history) {
      if (item.type !== "entry") continue;
      const note = item.entryNote?.trim() || item.slabNotes?.trim();
      if (note && !map.has(item.slabId)) {
        map.set(item.slabId, note);
      }
    }
    return map;
  }, [state.history]);

  const rackAvailability = useMemo(
    () =>
      state.racks
        .map((rack) => ({
          rack,
          load: getRackLoad(state, rack.id),
          available: getRackLoad(state, rack.id) < rack.capacity,
        }))
        .sort((a, b) =>
          a.rack.name.localeCompare(b.rack.name, undefined, { numeric: true }),
        ),
    [state],
  );

  const selectedExitEntry = useMemo(
    () =>
      selectedExitHistoryId
        ? state.history.find(
            (entry) =>
              entry.id === selectedExitHistoryId && entry.type === "exit",
          ) || null
        : null,
    [selectedExitHistoryId, state.history],
  );

  const activeSlabIds = useMemo(
    () => new Set(state.slabs.map((slab) => slab.id)),
    [state.slabs],
  );

  const preferredRecoveryRack = useMemo(() => {
    if (!selectedExitEntry) return undefined;
    const originalRackId = selectedExitEntry.fromRack?.toLowerCase();
    return (
      rackAvailability.find(({ rack, available }) =>
        available && originalRackId ? rack.id === originalRackId : false,
      )?.rack || rackAvailability.find(({ available }) => available)?.rack
    );
  }, [rackAvailability, selectedExitEntry]);

  const originalRackStatus = useMemo(() => {
    if (!selectedExitEntry?.fromRack) return null;
    const originalRackId = selectedExitEntry.fromRack.toLowerCase();
    const info = rackAvailability.find(
      ({ rack }) => rack.id === originalRackId,
    );
    if (!info) {
      return {
        tone: "text-red-600 dark:text-red-400",
        label: `Original rack ${selectedExitEntry.fromRack} no longer exists.`,
      };
    }

    if (info.available) {
      return {
        tone: "text-green-600 dark:text-green-400",
        label: `Original rack ${info.rack.name} is available (${info.load}/${info.rack.capacity}).`,
      };
    }

    return {
      tone: "text-amber-600 dark:text-amber-400",
      label: `Original rack ${info.rack.name} is full (${info.load}/${info.rack.capacity}). Choose another rack.`,
    };
  }, [rackAvailability, selectedExitEntry]);

  const selectedRecoveryRack = useMemo(
    () =>
      rackAvailability.find(({ rack }) => rack.id === recoveryRackId)?.rack ||
      null,
    [rackAvailability, recoveryRackId],
  );

  const canRecoverSelectedExit = useMemo(() => {
    if (!selectedExitEntry) return false;
    if (activeSlabIds.has(selectedExitEntry.slabId)) return false;
    if (!selectedExitEntry.slabThickness || !selectedExitEntry.slabSize)
      return false;
    return rackAvailability.some(({ available }) => available);
  }, [activeSlabIds, rackAvailability, selectedExitEntry]);

  useEffect(() => {
    if (!selectedExitEntry) return;
    if (!preferredRecoveryRack) {
      setRecoveryRackId("");
      return;
    }
    setRecoveryRackId((current) => current || preferredRecoveryRack.id);
  }, [preferredRecoveryRack, selectedExitEntry]);

  const openRecoveryDialog = (historyId: string) => {
    setSelectedExitHistoryId(historyId);
    setRecoveryError(null);
  };

  const closeRecoveryDialog = () => {
    setSelectedExitHistoryId(null);
    setRecoveryRackId("");
    setRecoveryError(null);
  };

  const handleRecover = async () => {
    if (!selectedExitEntry || !recoveryRackId) {
      setRecoveryError("Select a rack to restore this slab.");
      return;
    }
    if (isRecovering) return;

    setIsRecovering(true);
    try {
      const result = await recoverExitedSlab(
        state,
        selectedExitEntry.id,
        recoveryRackId,
        userName,
      );
      if (result.error) {
        setRecoveryError(result.error);
        return;
      }

      setState(result.nextState);
      closeRecoveryDialog();
    } catch (error) {
      setRecoveryError(
        error instanceof Error
          ? error.message
          : "Could not restore this slab. Please try again.",
      );
      const fresh = await fetchStateFromDb();
      if (fresh) setState(fresh);
    } finally {
      setIsRecovering(false);
    }
  };

  const handlePrint = (mode: "filtered" | "all") => {
    setPrintMode(mode);
    setTimeout(() => window.print(), 50);
  };

  const handleClearFilters = () => {
    setSlabFilter("");
    setClientFilter("");
    setScannerIdFilter("");
    setNotesFilter("");
    setDateFilter("");
    setSelectedBrands([]);
    setActionFilter("all");
  };

  const hasActiveFilters =
    slabFilter.trim().length > 0 ||
    clientFilter.trim().length > 0 ||
    scannerIdFilter.trim().length > 0 ||
    notesFilter.trim().length > 0 ||
    dateFilter.trim().length > 0 ||
    selectedBrands.length > 0 ||
    actionFilter !== "all";

  const handleRowClick = (historyId: string) => {
    setLastClickedHistoryId(historyId);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(rowStorageKey, historyId);
  };

  useEffect(() => {
    setMounted(true);
    const resetMode = () => setPrintMode("filtered");
    window.addEventListener("afterprint", resetMode);
    return () => window.removeEventListener("afterprint", resetMode);
  }, []);

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

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading history...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scoped to this route only (was previously inherited from a global
          print rule in globals.css that affected every page's print output). */}
      <style>{`@page { size: auto; margin: 15mm 12mm 12mm 12mm; }`}</style>
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
          Slab History Log
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Track slab entry, exits, and moves with user/client details.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 print:hidden space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={slabFilter}
              onChange={(event) => setSlabFilter(event.target.value)}
              placeholder="Filter by slab"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <input
            value={clientFilter}
            onChange={(event) => setClientFilter(event.target.value)}
            placeholder="Filter by client"
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
          <input
            value={scannerIdFilter}
            onChange={(event) => setScannerIdFilter(event.target.value)}
            placeholder="Filter by scanner ID"
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
          <input
            value={notesFilter}
            onChange={(event) => setNotesFilter(event.target.value)}
            placeholder="Filter by notes"
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
          <input
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            placeholder="Filter by date"
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterMultiSelect
            label="Brand"
            options={brandOptions}
            selected={selectedBrands}
            onChange={setSelectedBrands}
          />
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm"
          >
            <option value="all">All actions</option>
            <option value="entry">Entry</option>
            <option value="change">Change</option>
            <option value="move">Move</option>
            <option value="exit">Exit</option>
            <option value="recovery">Recovery</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Showing {rows.length} of {state.history.length}
          </span>
          <div className="flex flex-wrap items-center gap-2">
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
            <button
              type="button"
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                hasActiveFilters
                  ? "cursor-pointer border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  : "cursor-not-allowed border border-transparent text-gray-400 dark:text-gray-600"
              }`}
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          </div>
        </div>
      </div>

      <div
        id="print-area"
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 print:shadow-none print:bg-white"
      >
        <div className="hidden print:block mb-3">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-2xl font-semibold text-gray-800">
              Slab History Log
            </h1>
            <p className="text-xs text-gray-600">
              Printed by {userName} on {printedAt.toLocaleDateString()} at{" "}
              {printedAt.toLocaleTimeString()}
            </p>
          </div>
        </div>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading history...
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm print-history-table">
              <thead>
                <tr className="hidden print:table-row print-spacer-row">
                  <th colSpan={9} aria-hidden="true" />
                </tr>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400 print:hidden">
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("date")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("date", "Date")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("action")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("action", "Action")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("slabId")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("slabId", "Slab ID")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("scannerId")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("scannerId", "Scanner ID")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("slab")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("slab", "Name")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("brand")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("brand", "Brand")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() =>
                        handleCombinedSort(["finish", "thickness", "size"])
                      }
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderCombinedSortLabel([
                        { key: "finish", label: "Finish" },
                        { key: "thickness", label: "Thickness" },
                        { key: "size", label: "Size" },
                      ])}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleCombinedSort(["batch", "type"])}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderCombinedSortLabel([
                        { key: "batch", label: "Batch" },
                        { key: "type", label: "Type" },
                      ])}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("client")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("client", "Client")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleCombinedSort(["jobId", "notes"])}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderCombinedSortLabel([
                        { key: "jobId", label: "Job ID" },
                        { key: "notes", label: "Notes" },
                      ])}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("from")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("from", "From")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("to")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("to", "To")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("user")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("user", "User")}
                    </button>
                  </th>
                </tr>
                <tr className="hidden print:table-row text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-2 pr-4 print-col-date">Date</th>
                  <th className="py-2 pr-4 print-col-action">Action</th>
                  <th className="py-2 pr-4 print-col-slab">Slab / Scanner ID</th>
                  <th className="py-2 pr-4 print-col-name">
                    Slab / Brand / Finish
                  </th>
                  <th className="py-2 pr-4 print-col-batch">Batch / Type</th>
                  <th className="py-2 pr-4 print-col-client">Client</th>
                  <th className="py-2 pr-4 print-col-move">From / To</th>
                  <th className="py-2 pr-4 print-col-jobnotes">
                    Job ID / Notes
                  </th>
                  <th className="py-2 pr-4 print-col-user">User</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => handleRowClick(entry.id)}
                    className={`border-t border-gray-100 dark:border-gray-800 cursor-pointer transition-colors ${
                      lastClickedHistoryId === entry.id
                        ? "bg-amber-50 dark:bg-amber-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                    }`}
                  >
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 print:hidden">
                      {(() => {
                        const { datePart, timePart } = formatHistoryTimestamp(
                          entry.timestamp,
                        );
                        return (
                          <div className="space-y-1">
                            <div>{datePart}</div>
                            {timePart ? (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {timePart}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 pr-4 font-medium text-gray-800 dark:text-gray-100 print:hidden">
                      {entry.type === "exit" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openRecoveryDialog(entry.id)}
                            className="print:hidden rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          >
                            Exit
                          </button>
                          <span className="hidden print:inline">
                            {formatType(entry.type)}
                          </span>
                        </>
                      ) : (
                        formatType(entry.type)
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 print:hidden">
                      <a
                        href={`/slab/${encodeURIComponent(entry.slabId)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-600 hover:text-teal-700 hover:underline"
                      >
                        {entry.slabId}
                      </a>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 print:hidden">
                      {entry.slabScannerId ? (
                        <a
                          href={buildSlabViewUrl(entry.slabScannerId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {entry.slabScannerId}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 print:hidden">
                      {entry.slabName}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 print:hidden">
                      {entry.brand || "-"}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 print:hidden">
                      <div className="space-y-1">
                        <div>{entry.finish || "-"}</div>
                        <div>
                          {[
                            entry.slabThickness || "-",
                            entry.slabSize || "-",
                          ].join(" · ")}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 print:hidden">
                      <div className="space-y-1">
                        <div>
                          {entry.batchIndex && entry.batchSize
                            ? `${entry.batchIndex}/${entry.batchSize}`
                            : "-"}
                        </div>
                        <div>{entry.slabType}</div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 print:hidden">
                      {(() => {
                        const { clientName, originalClientName } =
                          splitClientName(entry.clientName);
                        const subtitle =
                          clientSubtitleByName[clientName.trim().toLowerCase()];
                        return (
                          <div className="space-y-1">
                            <div>{clientName || "-"}</div>
                            {subtitle ? (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {subtitle}
                              </div>
                            ) : null}
                            {entry.slabType === "GMD" && originalClientName ? (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Original Client: {originalClientName}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 print:hidden">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-700 dark:text-gray-200">
                          {entry.jobId || "-"}
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Entry:
                          </span>{" "}
                          <span>
                            {entryNoteBySlabId.get(entry.slabId) || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Exit:
                          </span>{" "}
                          <span>{entry.exitNote || "-"}</span>
                        </div>
                        {entry.type === "recovery" &&
                        entry.recoveredFromHistoryId ? (
                          <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Restored:
                            </span>{" "}
                            <span>From exit record</span>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 print:hidden">
                      {entry.fromRack ? `${entry.fromRack}` : "-"}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 print:hidden">
                      {entry.type === "exit"
                        ? "EXIT"
                        : entry.toRack
                          ? `${entry.toRack}`
                          : "-"}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 print:hidden">
                      {entry.userName}
                    </td>
                    <td className="hidden print:table-cell py-3 pr-4 print-col-date">
                      {(() => {
                        const { datePart, timePart } = formatHistoryTimestamp(
                          entry.timestamp,
                        );
                        return (
                          <div>
                            <div>{datePart}</div>
                            {timePart ? <div>{timePart}</div> : null}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="hidden print:table-cell py-3 pr-4 print-col-action">
                      {formatType(entry.type)}
                    </td>
                    <td className="hidden print:table-cell py-3 pr-4 print-col-slab">
                      <div>{entry.slabId}</div>
                      <div>{entry.slabScannerId || "-"}</div>
                    </td>
                    <td className="hidden print:table-cell py-3 pr-4 print-col-name">
                      <div>{entry.slabName}</div>
                      <div>
                        {[entry.brand || "-", entry.finish || "-"].join(" · ")}
                      </div>
                    </td>
                    <td className="hidden print:table-cell py-3 pr-4 print-col-batch">
                      <div>
                        {entry.batchIndex && entry.batchSize
                          ? `${entry.batchIndex}/${entry.batchSize}`
                          : "-"}
                      </div>
                      <div>{entry.slabType}</div>
                    </td>
                    <td className="hidden print:table-cell py-3 pr-4 print-col-client">
                      {(() => {
                        const { clientName, originalClientName } =
                          splitClientName(entry.clientName);
                        const subtitle =
                          clientSubtitleByName[clientName.trim().toLowerCase()];
                        return (
                          <div>
                            <div>{clientName || "-"}</div>
                            {subtitle ? <div>{subtitle}</div> : null}
                            {entry.slabType === "GMD" && originalClientName ? (
                              <div>Original Client: {originalClientName}</div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="hidden print:table-cell py-3 pr-4 print-col-move">
                      {entry.fromRack ? `${entry.fromRack}` : "-"}
                      {" → "}
                      {entry.type === "exit"
                        ? "EXIT"
                        : entry.toRack
                          ? `${entry.toRack}`
                          : "-"}
                    </td>
                    <td className="hidden print:table-cell py-3 pr-4 print-col-jobnotes">
                      <div>{entry.jobId || "-"}</div>
                      <div>Entry: {entryNoteBySlabId.get(entry.slabId) || "-"}</div>
                      <div>Exit: {entry.exitNote || "-"}</div>
                    </td>
                    <td className="hidden print:table-cell py-3 pr-4 print-col-user">
                      {entry.userName}
                    </td>
                  </tr>
                ))}
                {displayRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={13}
                      className="py-6 text-center text-gray-500 dark:text-gray-400 print:hidden"
                    >
                      No history entries yet.
                    </td>
                    <td
                      colSpan={9}
                      className="hidden print:table-cell py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      No history entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedExitEntry ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Retrieve exited slab
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Restore this slab to its original rack or move it to another
                  rack with space.
                </p>
              </div>
              <button
                type="button"
                onClick={closeRecoveryDialog}
                className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="Close recovery dialog"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-800 dark:bg-gray-950/40 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Slab
                </div>
                <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                  {selectedExitEntry.slabName}
                </div>
                <div className="mt-1 text-gray-600 dark:text-gray-300">
                  {selectedExitEntry.slabId}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Scanner ID
                </div>
                <div className="mt-1 text-gray-900 dark:text-gray-100">
                  {selectedExitEntry.slabScannerId || "-"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Client
                </div>
                <div className="mt-1 text-gray-900 dark:text-gray-100">
                  {splitClientName(selectedExitEntry.clientName).clientName ||
                    "-"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Type
                </div>
                <div className="mt-1 text-gray-900 dark:text-gray-100">
                  {selectedExitEntry.slabType}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Brand / Finish
                </div>
                <div className="mt-1 text-gray-900 dark:text-gray-100">
                  {[selectedExitEntry.brand, selectedExitEntry.finish]
                    .filter(Boolean)
                    .join(" / ") || "-"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Size / Thickness
                </div>
                <div className="mt-1 text-gray-900 dark:text-gray-100">
                  {[selectedExitEntry.slabSize, selectedExitEntry.slabThickness]
                    .filter(Boolean)
                    .join(" / ") || "-"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Job ID
                </div>
                <div className="mt-1 text-gray-900 dark:text-gray-100">
                  {selectedExitEntry.jobId || "-"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Original rack
                </div>
                <div className="mt-1 text-gray-900 dark:text-gray-100">
                  {selectedExitEntry.fromRack || "-"}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Notes
                </div>
                <div className="mt-1 space-y-1 text-gray-900 dark:text-gray-100">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Entry:
                    </span>{" "}
                    {entryNoteBySlabId.get(selectedExitEntry.slabId) ||
                      selectedExitEntry.slabNotes ||
                      "-"}
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">
                      Exit:
                    </span>{" "}
                    {selectedExitEntry.exitNote || "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {activeSlabIds.has(selectedExitEntry.slabId) ? (
                <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                  This slab is already active in inventory, so this exit record
                  cannot be restored again.
                </p>
              ) : null}

              {!selectedExitEntry.slabThickness ||
              !selectedExitEntry.slabSize ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  This older exit record is missing slab size or thickness, so
                  it cannot be restored automatically.
                </p>
              ) : null}

              {originalRackStatus ? (
                <p className={`text-sm ${originalRackStatus.tone}`}>
                  {originalRackStatus.label}
                </p>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Restore to rack
                </span>
                <select
                  value={recoveryRackId}
                  onChange={(event) => setRecoveryRackId(event.target.value)}
                  disabled={!canRecoverSelectedExit}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Select a rack</option>
                  {rackAvailability
                    .filter(({ available }) => available)
                    .map(({ rack, load }) => (
                      <option key={rack.id} value={rack.id}>
                        {rack.name} ({load}/{rack.capacity})
                      </option>
                    ))}
                </select>
              </label>

              {selectedRecoveryRack ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  The slab will be restored into {selectedRecoveryRack.name}.
                </p>
              ) : null}

              {!rackAvailability.some(({ available }) => available) ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  No racks currently have space available. Free up a spot first,
                  then try again.
                </p>
              ) : null}

              {recoveryError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {recoveryError}
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeRecoveryDialog}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecover}
                disabled={
                  !canRecoverSelectedExit || !recoveryRackId || isRecovering
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 dark:disabled:bg-blue-900/50"
              >
                {isRecovering ? "Recovering..." : "Recover slab"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

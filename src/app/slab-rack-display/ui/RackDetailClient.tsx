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
  splitClientName,
} from "./storage";

const SLAB_VIEW_LICENSE = "532b5c05af7b036ff8a0200d0c8dc6da";
const buildSlabViewUrl = (scannerId: string) =>
  `https://fusiondrivecloud.com/slabview/?license=${SLAB_VIEW_LICENSE}&SlabID=${encodeURIComponent(
    scannerId,
  )}`;

type RackSlabSortKey =
  | "id"
  | "scannerId"
  | "name"
  | "brand"
  | "finish"
  | "thickness"
  | "size"
  | "batch"
  | "type"
  | "client"
  | "jobId"
  | "notes"
  | "createdAt";

type SortDirection = "asc" | "desc";

export default function RackDetailClient({ userName }: { userName: string }) {
  const params = useParams();
  const router = useRouter();
  const rackId = String(params?.rackId ?? "").toLowerCase();
  const rowStorageKey = `slabbay:last-row:rack:${rackId || "unknown"}`;
  const [state, setState] = useState<SlabBayState>(() => loadState());
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastClickedSlabId, setLastClickedSlabId] = useState("");
  const [clientSubtitleByName, setClientSubtitleByName] = useState<
    Record<string, string | null>
  >({});
  const [sortKey, setSortKey] = useState<RackSlabSortKey>("id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(rowStorageKey);
    setLastClickedSlabId(stored || "");
  }, [rowStorageKey]);

  useEffect(() => {
    let active = true;
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
    return () => {
      active = false;
    };
  }, [hasLoaded]);

  const rack = useMemo(() => getRackById(state, rackId), [state, rackId]);
  const slabs = useMemo(
    () => (rack ? getSlabsByRack(state, rack.id) : []),
    [state, rack],
  );

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

  const handleSort = (key: RackSlabSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const renderSortLabel = (key: RackSlabSortKey, label: string) => {
    const indicator =
      sortKey === key ? (sortDirection === "asc" ? " ▲" : " ▼") : "";
    return `${label}${indicator}`;
  };

  // For a combined header (e.g. "Finish / Thickness / Size"), clicking
  // cycles: field 1 asc -> field 1 desc -> field 2 asc -> field 2 desc ->
  // ... -> back to field 1 asc. Each sub-field keeps its own independent
  // sort behavior; only the active one shows an arrow.
  const handleCombinedSort = (fields: RackSlabSortKey[]) => {
    const currentIndex = fields.indexOf(sortKey);
    if (currentIndex === -1) {
      setSortKey(fields[0]);
      setSortDirection("asc");
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
    fields: { key: RackSlabSortKey; label: string }[],
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

  const sortedSlabs = useMemo(() => {
    return [...slabs].sort((a, b) => {
      const aBatch =
        a.batchIndex && a.batchSize ? `${a.batchIndex}/${a.batchSize}` : "";
      const bBatch =
        b.batchIndex && b.batchSize ? `${b.batchIndex}/${b.batchSize}` : "";
      const aClient = splitClientName(a.clientName).clientName;
      const bClient = splitClientName(b.clientName).clientName;

      switch (sortKey) {
        case "id":
          return compareValues(a.id, b.id, sortDirection);
        case "scannerId":
          return compareValues(
            a.scannerId || "",
            b.scannerId || "",
            sortDirection,
          );
        case "name":
          return compareValues(a.name, b.name, sortDirection);
        case "brand":
          return compareValues(a.brand || "", b.brand || "", sortDirection);
        case "finish":
          return compareValues(a.finish || "", b.finish || "", sortDirection);
        case "thickness":
          return compareValues(
            a.thickness || "",
            b.thickness || "",
            sortDirection,
          );
        case "size":
          return compareValues(a.size || "", b.size || "", sortDirection);
        case "batch":
          return compareValues(aBatch, bBatch, sortDirection);
        case "type":
          return compareValues(a.type, b.type, sortDirection);
        case "client":
          return compareValues(aClient, bClient, sortDirection);
        case "jobId":
          return compareValues(a.jobId || "", b.jobId || "", sortDirection);
        case "notes":
          return compareValues(a.notes || "", b.notes || "", sortDirection);
        case "createdAt": {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) {
            return compareValues(aTime, bTime, sortDirection, true);
          }
          return compareValues(a.createdAt, b.createdAt, sortDirection);
        }
        default:
          return 0;
      }
    });
  }, [slabs, sortKey, sortDirection]);

  useEffect(() => {
    const clientNames = Array.from(
      new Set(
        slabs
          .map((slab) => splitClientName(slab.clientName).clientName.trim())
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
  }, [slabs]);

  const formatTimestamp = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { datePart: value, timePart: "" };
    return {
      datePart: date.toLocaleDateString(),
      timePart: date.toLocaleTimeString(),
    };
  };

  const renderClientCell = (clientValue: string, slabType: string) => {
    const { clientName, originalClientName } = splitClientName(clientValue);
    const subtitle = clientSubtitleByName[clientName.trim().toLowerCase()];
    return (
      <div className="space-y-1">
        <div>{clientName || "-"}</div>
        {subtitle ? (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {subtitle}
          </div>
        ) : null}
        {slabType === "GMD" && originalClientName ? (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Original Client: {originalClientName}
          </div>
        ) : null}
      </div>
    );
  };

  const handleRowClick = (slabId: string) => {
    setLastClickedSlabId(slabId);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(rowStorageKey, slabId);
  };

  if (!rack && !hasLoaded) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading rack...
        </p>
      </div>
    );
  }

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
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading slabs...
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSort("id")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("id", "Slab ID")}
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
                      onClick={() => handleSort("name")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("name", "Name")}
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
                      onClick={() => handleSort("createdAt")}
                      className="font-inherit uppercase tracking-wide hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {renderSortLabel("createdAt", "Date Added")}
                    </button>
                  </th>
                  <th className="py-2 pr-4">Label</th>
                </tr>
              </thead>
              <tbody>
                {sortedSlabs.map((slab) => (
                  <tr
                    key={slab.id}
                    onClick={() => handleRowClick(slab.id)}
                    className={`border-t border-gray-100 dark:border-gray-800 cursor-pointer transition-colors ${
                      lastClickedSlabId === slab.id
                        ? "bg-amber-50 dark:bg-amber-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                    }`}
                  >
                    <td className="py-3 pr-4 font-medium text-gray-800 dark:text-gray-100">
                      {slab.id}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {slab.scannerId ? (
                        <a
                          href={buildSlabViewUrl(slab.scannerId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {slab.scannerId}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {slab.name}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {slab.brand || "-"}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      <div className="space-y-1">
                        <div>{slab.finish || "-"}</div>
                        <div>{[slab.thickness, slab.size].join(" · ")}</div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      <div className="space-y-1">
                        <div>
                          {slab.batchIndex && slab.batchSize
                            ? `${slab.batchIndex}/${slab.batchSize}`
                            : "-"}
                        </div>
                        <div>{slab.type}</div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {renderClientCell(slab.clientName, slab.type)}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-700 dark:text-gray-200">
                          {slab.jobId || "-"}
                        </div>
                        <div>{slab.notes || "-"}</div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {(() => {
                        const { datePart, timePart } = formatTimestamp(
                          slab.createdAt,
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
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      <a
                        href={`/print/slab-label/${slab.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 transition-colors"
                      >
                        🖨️ Print
                      </a>
                    </td>
                  </tr>
                ))}
                {sortedSlabs.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      No slabs in this rack yet.
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

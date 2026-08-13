"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, ChevronDown, Wrench, Check, Minus } from "lucide-react";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";
import {
  classifyVehicleStatus,
  VEHICLE_STATUS_STYLES,
} from "@/lib/vehicleMaintenanceCalc";

type DriverOption = { id: string; name: string };

type Inspection = {
  id: string;
  inspectedAt: string;
  mileage: number;
  waterLevelOk: boolean | null;
  oilLevelOk: boolean | null;
  tiresOk: boolean | null;
  sunpassOk: boolean | null;
  conditionNote: string | null;
  repairNote: string | null;
  nextChangeMileage: number;
  milesRemaining: number | null;
  milesExceeded: number | null;
  immediateChangeRequired: boolean;
  isOilChangeEvent: boolean;
  vehicle: { id: string; name: string; internalNumber: string | null; plate: string | null };
  driver: { id: string; name: string } | null;
  createdBy: { name: string | null; email: string | null } | null;
};

const DEFAULT_DUE_SOON_THRESHOLD = 500;

function getWeekStart(iso: string) {
  const d = new Date(iso);
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function formatWeekLabel(weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const thisWeekStart = getWeekStart(new Date().toISOString());

  const diffWeeks = Math.round(
    (thisWeekStart.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  const range = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  if (diffWeeks === 0) return `This Week (${range})`;
  if (diffWeeks === 1) return `Last Week (${range})`;
  return `Week of ${range}`;
}

function CheckPill({ label, value }: { label: string; value: boolean | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-400">
        <Minus className="h-2.5 w-2.5" /> {label}
      </span>
    );
  }
  return value ? (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] text-green-800 dark:bg-green-900/30 dark:text-green-300">
      <Check className="h-2.5 w-2.5" /> {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] text-red-800 dark:bg-red-900/30 dark:text-red-300">
      <X className="h-2.5 w-2.5" /> {label}
    </span>
  );
}

export default function MaintenanceLogClient({
  drivers,
}: {
  drivers: DriverOption[];
}) {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dueSoonThresholdMiles, setDueSoonThresholdMiles] = useState(
    DEFAULT_DUE_SOON_THRESHOLD,
  );

  const [search, setSearch] = useState("");
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [immediateOnly, setImmediateOnly] = useState(false);
  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [inspectionsRes, settingsRes] = await Promise.all([
        fetch("/api/vehicles/inspections"),
        fetch("/api/vehicles/settings"),
      ]);
      const json = await inspectionsRes.json();
      if (!inspectionsRes.ok) throw new Error(json?.error || "Failed to load log");
      setInspections(json);

      const settingsJson = await settingsRes.json();
      if (settingsRes.ok && settingsJson?.dueSoonThresholdMiles != null) {
        setDueSoonThresholdMiles(settingsJson.dueSoonThresholdMiles);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load log");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const driverNames = useMemo(() => drivers.map((d) => d.name), [drivers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    if (to) to.setHours(23, 59, 59, 999);

    return inspections.filter((insp) => {
      if (immediateOnly && !insp.immediateChangeRequired) return false;
      if (selectedDrivers.length > 0) {
        if (!insp.driver || !selectedDrivers.includes(insp.driver.name)) return false;
      }
      const inspectedAt = new Date(insp.inspectedAt);
      if (from && inspectedAt < from) return false;
      if (to && inspectedAt > to) return false;
      if (q) {
        const haystack = [insp.vehicle.name, insp.vehicle.internalNumber, insp.vehicle.plate]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [inspections, search, selectedDrivers, dateFrom, dateTo, immediateOnly]);

  const hasActiveFilters =
    search !== "" || selectedDrivers.length > 0 || dateFrom !== "" || dateTo !== "" || immediateOnly;

  function clearFilters() {
    setSearch("");
    setSelectedDrivers([]);
    setDateFrom("");
    setDateTo("");
    setImmediateOnly(false);
  }

  const weekGroups = useMemo(() => {
    const map = new Map<string, { weekStart: Date; items: Inspection[] }>();
    for (const insp of filtered) {
      const weekStart = getWeekStart(insp.inspectedAt);
      const key = weekStart.toISOString();
      if (!map.has(key)) map.set(key, { weekStart, items: [] });
      map.get(key)!.items.push(insp);
    }
    return Array.from(map.entries()).sort(
      (a, b) => b[1].weekStart.getTime() - a[1].weekStart.getTime(),
    );
  }, [filtered]);

  function toggleWeek(key: string, defaultExpanded: boolean) {
    setCollapsedOverrides((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? defaultExpanded),
    }));
  }

  function exportCsv() {
    const header = [
      "Date",
      "Vehicle",
      "Driver",
      "Mileage",
      "Water",
      "Oil",
      "Tires",
      "Sunpass",
      "Next Change",
      "Miles Remaining",
      "Miles Exceeded",
      "Status",
      "Condition Note",
      "Repair Note",
    ];
    const rows = filtered.map((insp) => [
      new Date(insp.inspectedAt).toLocaleDateString(),
      insp.vehicle.name,
      insp.driver?.name || "",
      String(insp.mileage),
      insp.waterLevelOk == null ? "" : insp.waterLevelOk ? "OK" : "Issue",
      insp.oilLevelOk == null ? "" : insp.oilLevelOk ? "OK" : "Issue",
      insp.tiresOk == null ? "" : insp.tiresOk ? "OK" : "Issue",
      insp.sunpassOk == null ? "" : insp.sunpassOk ? "OK" : "Issue",
      String(insp.nextChangeMileage),
      insp.milesRemaining == null ? "" : String(insp.milesRemaining),
      insp.milesExceeded == null ? "" : String(insp.milesExceeded),
      insp.immediateChangeRequired ? "Immediate Change Required" : "OK",
      insp.conditionNote || "",
      insp.repairNote || "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vehicle-maintenance-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Maintenance Log</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            History of vehicle inspections and oil/filter changes.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
        >
          Export CSV
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vehicle, plate..."
              className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <FilterMultiSelect
            label="Driver"
            options={driverNames}
            selected={selectedDrivers}
            onChange={setSelectedDrivers}
            fullWidth
            matchInputStyle
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
          <label className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-600">
            <input
              type="checkbox"
              checked={immediateOnly}
              onChange={(e) => setImmediateOnly(e.target.checked)}
            />
            Immediate Change Only
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Showing {filtered.length} of {inspections.length}
          </span>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors ${
              hasActiveFilters
                ? "cursor-pointer border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                : "cursor-not-allowed border border-transparent text-gray-400 dark:text-gray-600"
            }`}
          >
            <X className="h-3.5 w-3.5" /> Clear Filters
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          Loading maintenance log...
        </div>
      ) : weekGroups.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          No inspections found for these filters.
        </div>
      ) : (
        <div className="space-y-4">
          {weekGroups.map(([key, group], groupIdx) => {
            const defaultExpanded = groupIdx === 0;
            const expanded = collapsedOverrides[key] ?? defaultExpanded;
            const immediateCount = group.items.filter((i) => i.immediateChangeRequired).length;
            const bandClasses = groupIdx % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-800/40";

            return (
              <div
                key={key}
                className={`overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 ${bandClasses}`}
              >
                <button
                  type="button"
                  onClick={() => toggleWeek(key, defaultExpanded)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatWeekLabel(group.weekStart)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {group.items.length} inspection{group.items.length === 1 ? "" : "s"}
                      {immediateCount > 0 && (
                        <span className="ml-1.5 text-red-600 dark:text-red-400">
                          · {immediateCount} needs immediate change
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                  />
                </button>

                {expanded && (
                  <div className="space-y-2 border-t border-gray-100 p-3 dark:border-gray-700/60">
                    {group.items.map((insp) => {
                      const status = insp.isOilChangeEvent
                        ? null
                        : classifyVehicleStatus(
                            {
                              needsImmediateChange: insp.immediateChangeRequired,
                              milesRemaining: insp.milesRemaining,
                            },
                            dueSoonThresholdMiles,
                          );
                      const accent = insp.isOilChangeEvent
                        ? "border-l-4 border-purple-500"
                        : status
                          ? VEHICLE_STATUS_STYLES[status].accentClasses
                          : "";

                      return (
                        <div
                          key={insp.id}
                          className={`rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/40 ${accent}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 font-medium">
                                {insp.isOilChangeEvent && (
                                  <Wrench className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                )}
                                {insp.vehicle.internalNumber && (
                                  <span className="text-gray-400">#{insp.vehicle.internalNumber}</span>
                                )}
                                {insp.vehicle.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(insp.inspectedAt).toLocaleDateString(undefined, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}{" "}
                                · {insp.driver?.name || "No driver"} · {insp.mileage.toLocaleString()} mi
                              </div>
                            </div>
                            {insp.isOilChangeEvent ? (
                              <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                                Oil Change Completed
                              </span>
                            ) : status ? (
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VEHICLE_STATUS_STYLES[status].badgeClasses}`}
                              >
                                {insp.immediateChangeRequired
                                  ? `${insp.milesExceeded?.toLocaleString()} mi over`
                                  : `${insp.milesRemaining?.toLocaleString()} mi left`}
                              </span>
                            ) : null}
                          </div>

                          {!insp.isOilChangeEvent && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <CheckPill label="Water" value={insp.waterLevelOk} />
                              <CheckPill label="Oil" value={insp.oilLevelOk} />
                              <CheckPill label="Tires" value={insp.tiresOk} />
                              <CheckPill label="Sunpass" value={insp.sunpassOk} />
                            </div>
                          )}

                          {(insp.conditionNote || insp.repairNote) && (
                            <div className="mt-2 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                              {insp.conditionNote && <div>Note: {insp.conditionNote}</div>}
                              {insp.repairNote && <div>Repair: {insp.repairNote}</div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

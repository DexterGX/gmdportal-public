"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  X,
  Wrench,
  Share2,
  Check,
  History,
  Copy,
  MessageCircle,
  Printer,
  ChevronRight,
} from "lucide-react";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";
import {
  classifyVehicleStatus,
  VEHICLE_STATUS_STYLES,
  type VehicleStatusLevel,
} from "@/lib/vehicleMaintenanceCalc";

type Driver = { id: string; name: string };

type InspectionSummary = {
  id: string;
  inspectedAt: string;
  mileage: number;
  isOilChangeEvent: boolean;
  driver: Driver | null;
};

type Vehicle = {
  id: string;
  internalNumber: string | null;
  name: string;
  color: string | null;
  plate: string | null;
  hasPlate: boolean;
  sunpass: string | null;
  hasSunpass: boolean;
  filter: string | null;
  oil: string | null;
  notes: string | null;
  defaultDriver: Driver | null;
  oilChangeIntervalMiles: number;
  lastOilChangeMileage: number;
  currentMileage: number;
  nextChangeMileage: number;
  milesRemaining: number | null;
  milesExceeded: number | null;
  needsImmediateChange: boolean;
  lastInspectionAt: string | null;
  inspections: InspectionSummary[];
};

type HistoryEntry = {
  id: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  changedByUser: { name: string | null; email: string | null } | null;
};

type StatusFilter = "all" | VehicleStatusLevel;

const DEFAULT_DUE_SOON_THRESHOLD = 500;

export default function VehiclesDashboardClient({
  isAdmin,
}: {
  isAdmin: boolean;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [dueSoonThresholdMiles, setDueSoonThresholdMiles] = useState(
    DEFAULT_DUE_SOON_THRESHOLD,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeVehicle, setCompleteVehicle] = useState<Vehicle | null>(null);
  const [completeMileage, setCompleteMileage] = useState("");
  const [completeSaving, setCompleteSaving] = useState(false);

  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [vehiclesRes, driversRes, settingsRes] = await Promise.all([
        fetch("/api/vehicles?status=active"),
        fetch("/api/vehicles/drivers"),
        fetch("/api/vehicles/settings"),
      ]);
      const vehiclesJson = await vehiclesRes.json();
      if (!vehiclesRes.ok)
        throw new Error(vehiclesJson?.error || "Failed to load vehicles");
      setVehicles(vehiclesJson);

      const driversJson = await driversRes.json();
      if (driversRes.ok) setDrivers(driversJson);

      const settingsJson = await settingsRes.json();
      if (settingsRes.ok && settingsJson?.dueSoonThresholdMiles != null) {
        setDueSoonThresholdMiles(settingsJson.dueSoonThresholdMiles);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const decorated = useMemo(
    () =>
      vehicles.map((v) => ({
        ...v,
        status: classifyVehicleStatus(v, dueSoonThresholdMiles),
        latestInspection: v.inspections[0] || null,
      })),
    [vehicles, dueSoonThresholdMiles],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return decorated.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      const driverName = v.latestInspection?.driver?.name || v.defaultDriver?.name;
      if (selectedDrivers.length > 0) {
        if (!driverName || !selectedDrivers.includes(driverName)) return false;
      }
      if (q) {
        const haystack = [v.name, v.internalNumber, v.plate, driverName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [decorated, search, selectedDrivers, statusFilter]);

  const counts = useMemo(() => {
    return {
      total: decorated.length,
      immediate: decorated.filter((v) => v.status === "immediate").length,
      dueSoon: decorated.filter((v) => v.status === "dueSoon").length,
      ok: decorated.filter((v) => v.status === "ok").length,
    };
  }, [decorated]);

  const overdueVehicles = useMemo(
    () => decorated.filter((v) => v.needsImmediateChange),
    [decorated],
  );

  const hasActiveFilters =
    search !== "" || selectedDrivers.length > 0 || statusFilter !== "all";

  function clearFilters() {
    setSearch("");
    setSelectedDrivers([]);
    setStatusFilter("all");
  }

  const driverNames = useMemo(
    () => drivers.map((d) => d.name),
    [drivers],
  );

  function buildShareText() {
    const lines = overdueVehicles.map((v) => {
      const bits = [
        v.internalNumber ? `#${v.internalNumber}` : null,
        v.plate ? `Plate ${v.plate}` : null,
        v.filter ? `Filter ${v.filter}` : null,
      ].filter(Boolean);
      return `- ${v.name}${bits.length ? ` (${bits.join(", ")})` : ""} — ${v.milesExceeded} mi over`;
    });
    return [
      `Vehicles needing an immediate oil/filter change (${new Date().toLocaleDateString()}):`,
      "",
      ...(lines.length ? lines : ["None right now."]),
    ].join("\n");
  }

  function copyShareText() {
    void navigator.clipboard.writeText(buildShareText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function openWhatsApp() {
    const text = buildShareText();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  function openCompleteFor(vehicle: Vehicle) {
    setCompleteVehicle(vehicle);
    setCompleteMileage(String(vehicle.currentMileage || ""));
    setCompleteOpen(true);
  }

  async function submitCompleteChange() {
    if (!completeVehicle) return;
    const mileage = Number(completeMileage);
    if (!Number.isFinite(mileage) || mileage < 0) {
      setError("Enter a valid mileage.");
      return;
    }
    setCompleteSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/vehicles/${completeVehicle.id}/complete-change`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmedMileage: mileage }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save");
      setMessage(`Oil change completed for ${completeVehicle.name}.`);
      setCompleteOpen(false);
      setCompleteVehicle(null);
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to save");
    } finally {
      setCompleteSaving(false);
    }
  }

  async function openHistory(vehicle: Vehicle) {
    setHistoryVehicle(vehicle);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}/history`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load history");
      setHistoryEntries(json);
    } catch {
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function StatCard({
    label,
    value,
    active,
    onClick,
    classes,
  }: {
    label: string;
    value: number;
    active: boolean;
    onClick: () => void;
    classes: string;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`rounded-xl border p-4 text-left transition-colors ${
          active
            ? "border-blue-400 ring-2 ring-blue-200 dark:ring-blue-900"
            : "border-gray-200 dark:border-gray-700"
        } bg-white dark:bg-gray-800`}
      >
        <div className="text-xs uppercase text-gray-500 dark:text-gray-400">
          {label}
        </div>
        <div className={`mt-1 text-2xl font-bold ${classes}`}>{value}</div>
      </button>
    );
  }

  function StatusBadge({ status }: { status: VehicleStatusLevel }) {
    const style = VEHICLE_STATUS_STYLES[status];
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badgeClasses}`}
      >
        {style.label}
      </span>
    );
  }

  function VehicleActions({ vehicle }: { vehicle: (typeof decorated)[number] }) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        <Link
          href={`/vehicles/new-inspection?vehicleId=${vehicle.id}`}
          title="New Inspection"
          className="inline-flex items-center justify-center gap-0.5 rounded-md border border-blue-300 px-1.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
        >
          Inspect
        </Link>
        {vehicle.needsImmediateChange && (
          <button
            type="button"
            onClick={() => openCompleteFor(vehicle)}
            title="Complete Immediate Change"
            className="inline-flex items-center justify-center gap-0.5 rounded-md border border-green-300 px-1.5 py-1 text-[11px] font-medium text-green-700 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/30"
          >
            Complete
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={() => openHistory(vehicle)}
            title="History"
            className="inline-flex items-center justify-center gap-0.5 rounded-md border border-gray-300 px-1.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <History className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Vehicles</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Fleet status and oil/filter change tracking.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/vehicles/new-inspection"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New Inspection
          </Link>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            disabled={overdueVehicles.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
          >
            <Share2 className="h-4 w-4" /> Share Immediate Change
          </button>
          <button
            type="button"
            onClick={() => {
              setCompleteVehicle(null);
              setCompleteMileage("");
              setCompleteOpen(true);
            }}
            disabled={overdueVehicles.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-green-300 px-3 py-2 text-sm text-green-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-800"
          >
            <Wrench className="h-4 w-4" /> Complete Immediate Change
          </button>
        </div>
      </div>

      {(error || message) && (
        <div
          className={`rounded-md border p-3 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Active Vehicles"
          value={counts.total}
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
          classes="text-gray-900 dark:text-gray-100"
        />
        <StatCard
          label="Needs Immediate Change"
          value={counts.immediate}
          active={statusFilter === "immediate"}
          onClick={() => setStatusFilter("immediate")}
          classes="text-red-600 dark:text-red-400"
        />
        <StatCard
          label="Due Soon"
          value={counts.dueSoon}
          active={statusFilter === "dueSoon"}
          onClick={() => setStatusFilter("dueSoon")}
          classes="text-yellow-600 dark:text-yellow-400"
        />
        <StatCard
          label="OK"
          value={counts.ok}
          active={statusFilter === "ok"}
          onClick={() => setStatusFilter("ok")}
          classes="text-green-600 dark:text-green-400"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, number, plate, driver..."
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
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
          >
            <option value="all">All Statuses</option>
            <option value="immediate">Needs Immediate Change</option>
            <option value="dueSoon">Due Soon</option>
            <option value="ok">OK</option>
          </select>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Showing {filtered.length} of {vehicles.length}
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

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th className="border-r border-gray-200 px-4 py-2 dark:border-gray-700">Vehicle</th>
              <th className="border-r border-gray-200 px-4 py-2 dark:border-gray-700">Driver</th>
              <th className="border-r border-gray-200 px-4 py-2 dark:border-gray-700">Plate</th>
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">Mileage</th>
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">Next Change @</th>
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">Status</th>
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">Miles Left / Over</th>
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">Last Inspection</th>
              <th className="px-4 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading vehicles...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No vehicles found for these filters.
                </td>
              </tr>
            ) : (
              filtered.map((v) => {
                const driverName = v.latestInspection?.driver?.name || v.defaultDriver?.name;
                const style = VEHICLE_STATUS_STYLES[v.status];
                return (
                  <tr
                    key={v.id}
                    className={`border-b border-gray-100 dark:border-gray-700/60 ${style.accentClasses}`}
                  >
                    <td className="border-r border-gray-100 px-4 py-2 font-medium dark:border-gray-700/60">
                      {v.internalNumber && (
                        <span className="mr-1 text-gray-400">#{v.internalNumber}</span>
                      )}
                      {v.name}
                    </td>
                    <td className="border-r border-gray-100 px-4 py-2 dark:border-gray-700/60">
                      {driverName || "-"}
                    </td>
                    <td className="border-r border-gray-100 px-4 py-2 dark:border-gray-700/60">
                      {v.hasPlate ? v.plate || "-" : "No Plate"}
                    </td>
                    <td className="border-r border-gray-100 px-4 py-2 text-center dark:border-gray-700/60">
                      {v.currentMileage.toLocaleString()}
                    </td>
                    <td className="border-r border-gray-100 px-4 py-2 text-center dark:border-gray-700/60">
                      {v.nextChangeMileage.toLocaleString()}
                    </td>
                    <td className="border-r border-gray-100 px-4 py-2 text-center dark:border-gray-700/60">
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="border-r border-gray-100 px-4 py-2 text-center font-semibold dark:border-gray-700/60">
                      {v.needsImmediateChange ? (
                        <span className="text-red-600 dark:text-red-400">
                          {v.milesExceeded?.toLocaleString()} over
                        </span>
                      ) : (
                        <span>{v.milesRemaining?.toLocaleString()} left</span>
                      )}
                    </td>
                    <td className="border-r border-gray-100 px-4 py-2 text-center dark:border-gray-700/60">
                      {v.lastInspectionAt
                        ? new Date(v.lastInspectionAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="px-3 py-2">
                      <VehicleActions vehicle={v} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            Loading vehicles...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            No vehicles found for these filters.
          </div>
        ) : (
          filtered.map((v) => {
            const driverName = v.latestInspection?.driver?.name || v.defaultDriver?.name;
            const style = VEHICLE_STATUS_STYLES[v.status];
            return (
              <div
                key={v.id}
                className={`rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 ${style.accentClasses}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">
                      {v.internalNumber && (
                        <span className="mr-1 text-gray-400">#{v.internalNumber}</span>
                      )}
                      {v.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {driverName || "No driver"} · {v.hasPlate ? v.plate || "No plate" : "No plate"}
                    </div>
                  </div>
                  <StatusBadge status={v.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {v.currentMileage.toLocaleString()} mi
                  </span>
                  {v.needsImmediateChange ? (
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      {v.milesExceeded?.toLocaleString()} mi over
                    </span>
                  ) : (
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {v.milesRemaining?.toLocaleString()} mi left
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <VehicleActions vehicle={v} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Share Immediate Change modal */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-4 dark:bg-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Share Immediate Change ({overdueVehicles.length})
              </h2>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              {buildShareText()}
            </pre>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openWhatsApp}
                className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                <MessageCircle className="h-4 w-4" /> Open in WhatsApp
              </button>
              <button
                type="button"
                onClick={copyShareText}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy to Clipboard
                  </>
                )}
              </button>
              <a
                href="/vehicles/print/overdue"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
              >
                <Printer className="h-4 w-4" /> Open Print View
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Complete Immediate Change modal */}
      {completeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 dark:bg-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Complete Immediate Change
              </h2>
              <button
                type="button"
                onClick={() => {
                  setCompleteOpen(false);
                  setCompleteVehicle(null);
                }}
                className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!completeVehicle ? (
              overdueVehicles.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No vehicles currently need an immediate change.
                </p>
              ) : (
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {overdueVehicles.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => openCompleteFor(v)}
                      className="flex w-full items-center justify-between rounded-md border border-gray-200 px-3 py-3 text-left text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                    >
                      <span>
                        <span className="font-medium">{v.name}</span>{" "}
                        <span className="text-red-600 dark:text-red-400">
                          ({v.milesExceeded?.toLocaleString()} mi over)
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Confirm the mileage at which <strong>{completeVehicle.name}</strong>{" "}
                  had its oil/filter changed.
                </p>
                <input
                  type="number"
                  inputMode="numeric"
                  value={completeMileage}
                  onChange={(e) => setCompleteMileage(e.target.value)}
                  className="h-12 w-full rounded-lg border border-gray-300 bg-white px-3 text-center text-xl dark:border-gray-600 dark:bg-gray-900"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCompleteVehicle(null)}
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={submitCompleteChange}
                    disabled={completeSaving}
                    className="flex-1 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {completeSaving ? "Saving..." : "Confirm Change"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vehicle history modal (admin) */}
      {historyVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-4 dark:bg-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {historyVehicle.name} — History
              </h2>
              <button
                type="button"
                onClick={() => setHistoryVehicle(null)}
                className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {historyLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
            ) : historyEntries.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No history recorded yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-gray-500 dark:text-gray-400">
                    <th className="py-1 pr-2">Date</th>
                    <th className="py-1 pr-2">Action</th>
                    <th className="py-1 pr-2">Field</th>
                    <th className="py-1 pr-2">Old</th>
                    <th className="py-1 pr-2">New</th>
                    <th className="py-1 pr-2">By</th>
                  </tr>
                </thead>
                <tbody>
                  {historyEntries.map((h) => (
                    <tr key={h.id} className="border-t border-gray-100 dark:border-gray-700/60">
                      <td className="py-1 pr-2">{new Date(h.createdAt).toLocaleString()}</td>
                      <td className="py-1 pr-2">{h.action}</td>
                      <td className="py-1 pr-2">{h.fieldName || "-"}</td>
                      <td className="py-1 pr-2">{h.oldValue ?? "-"}</td>
                      <td className="py-1 pr-2">{h.newValue ?? "-"}</td>
                      <td className="py-1 pr-2">
                        {h.changedByUser?.name || h.changedByUser?.email || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

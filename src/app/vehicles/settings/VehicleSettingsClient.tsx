"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Settings2,
  Plus,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  History,
  X,
  Search,
} from "lucide-react";

type Driver = { id: string; name: string; active: boolean; sortOrder: number };

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
  defaultDriverId: string | null;
  defaultDriver: { id: string; name: string } | null;
  oilChangeIntervalMiles: number;
  lastOilChangeMileage: number;
  currentMileage: number;
  isActive: boolean;
};

type ProgramSettings = {
  id: string;
  defaultOilChangeIntervalMiles: number;
  dueSoonThresholdMiles: number;
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

const EMPTY_FORM = {
  internalNumber: "",
  name: "",
  color: "",
  defaultDriverId: "",
  oilChangeIntervalMiles: "5000",
  hasPlate: true,
  plate: "",
  hasSunpass: true,
  sunpass: "",
  filter: "",
  oil: "",
  notes: "",
  lastOilChangeMileage: "",
  startingCurrentMileage: "",
};

type VehicleFormState = typeof EMPTY_FORM;

function VehicleFormModal({
  editing,
  drivers,
  defaultInterval,
  onClose,
  onSaved,
}: {
  editing: Vehicle | null;
  drivers: Driver[];
  defaultInterval: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<VehicleFormState>(() =>
    editing
      ? {
          internalNumber: editing.internalNumber || "",
          name: editing.name,
          color: editing.color || "",
          defaultDriverId: editing.defaultDriverId || "",
          oilChangeIntervalMiles: String(editing.oilChangeIntervalMiles),
          hasPlate: editing.hasPlate,
          plate: editing.plate || "",
          hasSunpass: editing.hasSunpass,
          sunpass: editing.sunpass || "",
          filter: editing.filter || "",
          oil: editing.oil || "",
          notes: editing.notes || "",
          lastOilChangeMileage: String(editing.lastOilChangeMileage),
          startingCurrentMileage: "",
        }
      : { ...EMPTY_FORM, oilChangeIntervalMiles: String(defaultInterval) },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof VehicleFormState>(key: K, value: VehicleFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!form.name.trim()) {
      setError("Vehicle name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        internalNumber: form.internalNumber || null,
        name: form.name,
        color: form.color || null,
        defaultDriverId: form.defaultDriverId || null,
        oilChangeIntervalMiles: Number(form.oilChangeIntervalMiles) || 5000,
        hasPlate: form.hasPlate,
        plate: form.plate || null,
        hasSunpass: form.hasSunpass,
        sunpass: form.sunpass || null,
        filter: form.filter || null,
        oil: form.oil || null,
        notes: form.notes || null,
        lastOilChangeMileage: form.lastOilChangeMileage
          ? Number(form.lastOilChangeMileage)
          : undefined,
        startingLastOilChangeMileage: form.lastOilChangeMileage
          ? Number(form.lastOilChangeMileage)
          : undefined,
        startingCurrentMileage: form.startingCurrentMileage
          ? Number(form.startingCurrentMileage)
          : undefined,
      };

      const res = await fetch(
        editing ? `/api/vehicles/${editing.id}` : "/api/vehicles",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save vehicle");
      onSaved(editing ? "Vehicle updated." : "Vehicle created.");
    } catch (err: any) {
      setError(err?.message || "Failed to save vehicle");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-4 dark:bg-gray-800">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {editing ? `Edit ${editing.name}` : "New Vehicle"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Internal #</label>
            <input
              value={form.internalNumber}
              onChange={(e) => set("internalNumber", e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Name *</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Color</label>
            <input
              value={form.color}
              onChange={(e) => set("color", e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Default Driver</label>
            <select
              value={form.defaultDriverId}
              onChange={(e) => set("defaultDriverId", e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
            >
              <option value="">-</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Plate</label>
              <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={form.hasPlate}
                  onChange={(e) => set("hasPlate", e.target.checked)}
                />
                Has plate
              </label>
            </div>
            <input
              value={form.plate}
              disabled={!form.hasPlate}
              onChange={(e) => set("plate", e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Sunpass</label>
              <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={form.hasSunpass}
                  onChange={(e) => set("hasSunpass", e.target.checked)}
                />
                Has sunpass
              </label>
            </div>
            <input
              value={form.sunpass}
              disabled={!form.hasSunpass}
              onChange={(e) => set("sunpass", e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Filter</label>
            <input
              value={form.filter}
              onChange={(e) => set("filter", e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Oil</label>
            <input
              value={form.oil}
              onChange={(e) => set("oil", e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Oil-Change Interval (mi)
            </label>
            <input
              type="number"
              value={form.oilChangeIntervalMiles}
              onChange={(e) => set("oilChangeIntervalMiles", e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Mileage at Last Oil Change
            </label>
            <input
              type="number"
              value={form.lastOilChangeMileage}
              onChange={(e) => set("lastOilChangeMileage", e.target.value)}
              placeholder={editing ? undefined : "Defaults to 0"}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>

          {!editing && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Starting Current Mileage
              </label>
              <input
                type="number"
                value={form.startingCurrentMileage}
                onChange={(e) => set("startingCurrentMileage", e.target.value)}
                placeholder="Defaults to last oil change mileage"
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
              />
            </div>
          )}
          {editing && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Current Mileage
              </label>
              <div className="flex h-10 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                {editing.currentMileage.toLocaleString()} (set via inspections)
              </div>
            </div>
          )}

          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Vehicle"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DriversPanel({
  drivers,
  onChanged,
  showToast,
}: {
  drivers: Driver[];
  onChanged: () => void;
  showToast: (type: "success" | "error", message: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function addDriver() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/vehicles/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to add driver");
      setNewName("");
      onChanged();
    } catch (err: any) {
      showToast("error", err?.message || "Failed to add driver");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(driver: Driver) {
    try {
      const res = await fetch("/api/vehicles/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: driver.id,
          action: driver.active ? "deactivate" : "activate",
        }),
      });
      if (!res.ok) throw new Error();
      onChanged();
    } catch {
      showToast("error", "Failed to update driver");
    }
  }

  async function deleteDriver(driver: Driver) {
    if (!confirm(`Permanently delete driver "${driver.name}"?`)) return;
    try {
      const res = await fetch("/api/vehicles/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: driver.id, action: "delete" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to delete driver");
      showToast("success", "Driver deleted.");
      onChanged();
    } catch (err: any) {
      showToast("error", err?.message || "Failed to delete driver");
    }
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
      <h2 className="font-semibold text-gray-900 dark:text-gray-100">Drivers</h2>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Managed list used on the vehicle record and inspection form.
      </p>

      <div className="mb-4 space-y-2">
        {drivers.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No drivers yet.</p>
        ) : (
          drivers.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-md border border-gray-200 p-2 dark:border-gray-700"
            >
              <span
                className={`text-sm ${d.active ? "text-gray-900 dark:text-gray-100" : "text-gray-400 line-through"}`}
              >
                {d.name}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => toggleActive(d)}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    d.active
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {d.active ? "Active" : "Inactive"}
                </button>
                <button
                  onClick={() => deleteDriver(d)}
                  title="Delete Permanently"
                  className="rounded-md bg-red-50 p-1.5 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addDriver()}
          placeholder="New driver name..."
          className="flex-1 rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        />
        <button
          onClick={addDriver}
          disabled={saving || !newName.trim()}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
    </div>
  );
}

function ProgramSettingsPanel({
  settings,
  onChanged,
  showToast,
}: {
  settings: ProgramSettings | null;
  onChanged: () => void;
  showToast: (type: "success" | "error", message: string) => void;
}) {
  const [interval, setIntervalMiles] = useState("5000");
  const [threshold, setThreshold] = useState("500");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setIntervalMiles(String(settings.defaultOilChangeIntervalMiles));
      setThreshold(String(settings.dueSoonThresholdMiles));
    }
  }, [settings]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/vehicles/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultOilChangeIntervalMiles: Number(interval),
          dueSoonThresholdMiles: Number(threshold),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save settings");
      showToast("success", "Settings saved.");
      onChanged();
    } catch (err: any) {
      showToast("error", err?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
      <h2 className="font-semibold text-gray-900 dark:text-gray-100">Program Settings</h2>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Defaults applied across the Vehicles program.
      </p>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Default oil-change interval for new vehicles (miles)
          </label>
          <input
            type="number"
            value={interval}
            onChange={(e) => setIntervalMiles(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            &quot;Due Soon&quot; warning threshold (miles remaining)
          </label>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

export default function VehicleSettingsClient() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [settings, setSettings] = useState<ProgramSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "archived" | "all">("active");

  const [formOpen, setFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchAll = useCallback(async (statusValue: "active" | "archived" | "all" = status) => {
    setLoading(true);
    try {
      const [vehiclesRes, driversRes, settingsRes] = await Promise.all([
        fetch(`/api/vehicles?status=${statusValue}`),
        fetch("/api/vehicles/drivers?status=all"),
        fetch("/api/vehicles/settings"),
      ]);
      setVehicles(await vehiclesRes.json());
      setDrivers(await driversRes.json());
      setSettings(await settingsRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchAll(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) =>
      [v.name, v.internalNumber, v.plate]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [vehicles, search]);

  function openCreate() {
    setEditingVehicle(null);
    setFormOpen(true);
  }

  function openEdit(vehicle: Vehicle) {
    setEditingVehicle(vehicle);
    setFormOpen(true);
  }

  function onFormSaved(msg: string) {
    setFormOpen(false);
    setEditingVehicle(null);
    showToast("success", msg);
    void fetchAll();
  }

  async function toggleArchive(vehicle: Vehicle) {
    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !vehicle.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Action failed");
      showToast("success", vehicle.isActive ? "Archived." : "Restored.");
      void fetchAll();
    } catch (err: any) {
      showToast("error", err?.message || "Action failed");
    }
  }

  async function deleteVehicle(vehicle: Vehicle) {
    if (!confirm(`Permanently delete "${vehicle.name}"? This can't be undone.`)) return;
    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Delete failed");
      showToast("success", "Deleted.");
      void fetchAll();
    } catch (err: any) {
      showToast("error", err?.message || "Delete failed");
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[60] rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}

      <Link
        href="/vehicles"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Vehicles
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            <Settings2 className="h-7 w-7" /> Vehicle Settings
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Manage the fleet, drivers, and maintenance defaults.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add Vehicle
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vehicles..."
              className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th className="border-r border-gray-200 px-4 py-2 dark:border-gray-700">Vehicle</th>
              <th className="border-r border-gray-200 px-4 py-2 dark:border-gray-700">Driver</th>
              <th className="border-r border-gray-200 px-4 py-2 dark:border-gray-700">Plate</th>
              <th className="border-r border-gray-200 px-4 py-2 dark:border-gray-700">Sunpass</th>
              <th className="border-r border-gray-200 px-4 py-2 dark:border-gray-700">Filter</th>
              <th className="border-r border-gray-200 px-4 py-2 dark:border-gray-700">Oil</th>
              <th className="border-r border-gray-200 px-4 py-2 text-center dark:border-gray-700">Interval</th>
              <th className="px-4 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading vehicles...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No vehicles found.
                </td>
              </tr>
            ) : (
              filtered.map((v) => (
                <tr key={v.id} className="border-b border-gray-100 dark:border-gray-700/60">
                  <td className="border-r border-gray-100 px-4 py-2 font-medium dark:border-gray-700/60">
                    {v.internalNumber && <span className="mr-1 text-gray-400">#{v.internalNumber}</span>}
                    {v.name}
                    {!v.isActive && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        Archived
                      </span>
                    )}
                  </td>
                  <td className="border-r border-gray-100 px-4 py-2 dark:border-gray-700/60">
                    {v.defaultDriver?.name || "-"}
                  </td>
                  <td className="border-r border-gray-100 px-4 py-2 dark:border-gray-700/60">
                    {v.hasPlate ? v.plate || "-" : "No Plate"}
                  </td>
                  <td className="border-r border-gray-100 px-4 py-2 dark:border-gray-700/60">
                    {v.hasSunpass ? v.sunpass || "-" : "No Sunpass"}
                  </td>
                  <td className="border-r border-gray-100 px-4 py-2 dark:border-gray-700/60">{v.filter || "-"}</td>
                  <td className="border-r border-gray-100 px-4 py-2 dark:border-gray-700/60">{v.oil || "-"}</td>
                  <td className="border-r border-gray-100 px-4 py-2 text-center dark:border-gray-700/60">
                    {v.oilChangeIntervalMiles.toLocaleString()} mi
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-nowrap items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(v)}
                        title="Edit"
                        className="inline-flex items-center justify-center gap-0.5 rounded-md border border-blue-300 px-1.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openHistory(v)}
                        title="History"
                        className="inline-flex items-center justify-center gap-0.5 rounded-md border border-gray-300 px-1.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <History className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleArchive(v)}
                        title={v.isActive ? "Archive" : "Restore"}
                        className="inline-flex items-center justify-center gap-0.5 rounded-md border border-amber-300 px-1.5 py-1 text-[11px] font-medium text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/30"
                      >
                        {v.isActive ? <Archive className="h-3 w-3" /> : <ArchiveRestore className="h-3 w-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteVehicle(v)}
                        title="Delete Permanently"
                        className="inline-flex items-center justify-center gap-0.5 rounded-md border border-red-300 px-1.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <DriversPanel drivers={drivers} onChanged={() => void fetchAll()} showToast={showToast} />
        <ProgramSettingsPanel settings={settings} onChanged={() => void fetchAll()} showToast={showToast} />
      </div>

      {formOpen && (
        <VehicleFormModal
          editing={editingVehicle}
          drivers={drivers.filter((d) => d.active)}
          defaultInterval={settings?.defaultOilChangeIntervalMiles || 5000}
          onClose={() => setFormOpen(false)}
          onSaved={onFormSaved}
        />
      )}

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
                      <td className="py-1 pr-2">{h.changedByUser?.name || h.changedByUser?.email || "-"}</td>
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

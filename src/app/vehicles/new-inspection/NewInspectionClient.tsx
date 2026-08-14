"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, AlertTriangle, Check } from "lucide-react";
import {
  computeMaintenanceStatus,
  VEHICLE_STATUS_STYLES,
} from "@/lib/vehicleMaintenanceCalc";

type VehicleOption = {
  id: string;
  internalNumber: string | null;
  name: string;
  plate: string | null;
  filter: string | null;
  currentMileage: number;
  defaultDriverId: string | null;
};

type DriverOption = { id: string; name: string };

type CheckKey = "waterLevelOk" | "oilLevelOk" | "tiresOk" | "sunpassOk";

const CHECKS: { key: CheckKey; label: string }[] = [
  { key: "waterLevelOk", label: "Water" },
  { key: "oilLevelOk", label: "Oil" },
  { key: "tiresOk", label: "Tires" },
  { key: "sunpassOk", label: "Sunpass" },
];

export default function NewInspectionClient({
  vehicles,
  drivers,
  preselectedVehicleId,
}: {
  vehicles: VehicleOption[];
  drivers: DriverOption[];
  preselectedVehicleId: string | null;
}) {
  const [vehicleId, setVehicleId] = useState<string | null>(
    preselectedVehicleId,
  );
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(
    !preselectedVehicleId,
  );
  const [vehicleQuery, setVehicleQuery] = useState("");

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === vehicleId) || null,
    [vehicles, vehicleId],
  );

  const [driverId, setDriverId] = useState<string | null>(
    selectedVehicle?.defaultDriverId || null,
  );
  const [driverPickerOpen, setDriverPickerOpen] = useState(false);

  const selectedDriver = useMemo(
    () => drivers.find((d) => d.id === driverId) || null,
    [drivers, driverId],
  );

  const [mileage, setMileage] = useState("");
  const [checks, setChecks] = useState<Record<CheckKey, boolean | null>>({
    waterLevelOk: null,
    oilLevelOk: null,
    tiresOk: null,
    sunpassOk: null,
  });
  const [notesOpen, setNotesOpen] = useState(false);
  const [conditionNote, setConditionNote] = useState("");
  const [repairNote, setRepairNote] = useState("");
  const [confirmMileage, setConfirmMileage] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<null | {
    vehicleName: string;
    status: ReturnType<typeof computeMaintenanceStatus>;
    filter: string | null;
  }>(null);

  const filteredVehicles = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) =>
      [v.name, v.internalNumber, v.plate]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [vehicles, vehicleQuery]);

  const mileageNum = Number(mileage);
  const mileageValid = mileage.trim() !== "" && Number.isFinite(mileageNum) && mileageNum >= 0;

  const mileageWarning = useMemo(() => {
    if (!selectedVehicle || !mileageValid) return null;
    if (mileageNum < selectedVehicle.currentMileage) {
      return `This is lower than the last recorded mileage (${selectedVehicle.currentMileage.toLocaleString()} mi). Double-check the odometer reading.`;
    }
    if (mileageNum - selectedVehicle.currentMileage > 2000) {
      return `That's a jump of ${(mileageNum - selectedVehicle.currentMileage).toLocaleString()} mi since the last inspection. Double-check for a typo.`;
    }
    return null;
  }, [selectedVehicle, mileageValid, mileageNum]);

  function selectVehicle(v: VehicleOption) {
    setVehicleId(v.id);
    setDriverId(v.defaultDriverId);
    setVehiclePickerOpen(false);
    setConfirmMileage(false);
  }

  function toggleCheck(key: CheckKey, value: boolean) {
    setChecks((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }));
  }

  const canSubmit =
    !!vehicleId &&
    mileageValid &&
    (!mileageWarning || confirmMileage) &&
    !submitting;

  async function submit() {
    if (!vehicleId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/vehicles/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId,
          driverId,
          mileage: mileageNum,
          waterLevelOk: checks.waterLevelOk,
          oilLevelOk: checks.oilLevelOk,
          tiresOk: checks.tiresOk,
          sunpassOk: checks.sunpassOk,
          conditionNote: conditionNote.trim() || undefined,
          repairNote: repairNote.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save inspection");
      setResult({
        vehicleName: selectedVehicle
          ? `${selectedVehicle.internalNumber ? `#${selectedVehicle.internalNumber} ` : ""}${selectedVehicle.name}`
          : "Vehicle",
        status: json.status,
        filter: selectedVehicle?.filter || null,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to save inspection");
    } finally {
      setSubmitting(false);
    }
  }

  function logAnother() {
    setResult(null);
    setVehicleId(null);
    setVehiclePickerOpen(true);
    setVehicleQuery("");
    setMileage("");
    setChecks({ waterLevelOk: null, oilLevelOk: null, tiresOk: null, sunpassOk: null });
    setConditionNote("");
    setRepairNote("");
    setNotesOpen(false);
    setConfirmMileage(false);
    setError(null);
    // Driver is kept — one person often inspects several vehicles in a row.
  }

  if (result) {
    const level = result.status.immediateChangeRequired ? "immediate" : "ok";
    const style = VEHICLE_STATUS_STYLES[level];
    return (
      <div className="mx-auto max-w-md space-y-4 pb-24">
        <div className={`rounded-xl border p-5 ${style.accentClasses} bg-white dark:bg-gray-800`}>
          <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badgeClasses}`}>
            {style.label}
          </div>
          <h1 className="mt-3 text-xl font-bold">{result.vehicleName}</h1>
          {result.status.immediateChangeRequired ? (
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              This vehicle needs an immediate oil/filter change —{" "}
              <span className="font-semibold text-red-600 dark:text-red-400">
                {result.status.milesExceeded?.toLocaleString()} mi over
              </span>
              .{" "}
              {result.filter && (
                <>
                  Filter: <span className="font-medium">{result.filter}</span>.
                </>
              )}
            </p>
          ) : (
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              {result.status.milesRemaining?.toLocaleString()} mi remaining until the next oil/filter change.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={logAnother}
            className="rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            Log Another Inspection
          </button>
          <Link
            href="/vehicles"
            className="rounded-md border border-gray-300 px-4 py-3 text-center text-sm dark:border-gray-600"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pb-28">
      <div>
        <h1 className="text-2xl font-bold">New Inspection</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Log mileage and condition checks for a vehicle.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Vehicle picker */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
          Vehicle
        </div>
        {!vehiclePickerOpen && selectedVehicle ? (
          <button
            type="button"
            onClick={() => setVehiclePickerOpen(true)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-300 px-3 py-3 text-left dark:border-gray-600"
          >
            <span>
              {selectedVehicle.internalNumber && (
                <span className="mr-1 text-gray-400">#{selectedVehicle.internalNumber}</span>
              )}
              <span className="font-semibold">{selectedVehicle.name}</span>
              {selectedVehicle.plate && (
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  {selectedVehicle.plate}
                </span>
              )}
            </span>
            <span className="text-sm text-blue-600 dark:text-blue-400">Change</span>
          </button>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={vehicleQuery}
                onChange={(e) => setVehicleQuery(e.target.value)}
                placeholder="Search vehicles..."
                className="h-12 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-base dark:border-gray-600 dark:bg-gray-900"
              />
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {filteredVehicles.length === 0 ? (
                <p className="px-1 py-2 text-sm text-gray-500 dark:text-gray-400">
                  No vehicles match.
                </p>
              ) : (
                filteredVehicles.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selectVehicle(v)}
                    className="flex w-full items-center justify-between rounded-md border border-gray-200 px-3 py-3 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                  >
                    <span>
                      {v.internalNumber && (
                        <span className="mr-1 text-gray-400">#{v.internalNumber}</span>
                      )}
                      <span className="font-medium">{v.name}</span>
                      {v.plate && (
                        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                          {v.plate}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Driver picker */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
          Driver
        </div>
        {!driverPickerOpen ? (
          <button
            type="button"
            onClick={() => setDriverPickerOpen(true)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-300 px-3 py-3 text-left dark:border-gray-600"
          >
            <span>{selectedDriver ? selectedDriver.name : "Select a driver"}</span>
            <span className="text-sm text-blue-600 dark:text-blue-400">Change</span>
          </button>
        ) : (
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {drivers.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setDriverId(d.id);
                  setDriverPickerOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md border border-gray-200 px-3 py-3 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                <span>{d.name}</span>
                {driverId === d.id && <Check className="h-4 w-4 text-blue-600" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mileage */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
          Mileage
        </div>
        <input
          type="number"
          inputMode="numeric"
          value={mileage}
          onChange={(e) => {
            setMileage(e.target.value);
            setConfirmMileage(false);
          }}
          placeholder="0"
          className="h-14 w-full rounded-lg border border-gray-300 bg-white text-center text-2xl font-semibold dark:border-gray-600 dark:bg-gray-900"
        />
        {selectedVehicle && (
          <p className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
            Last recorded: {selectedVehicle.currentMileage.toLocaleString()} mi
          </p>
        )}
        {mileageWarning && (
          <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <div className="flex gap-1.5">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{mileageWarning}</span>
            </div>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={confirmMileage}
                onChange={(e) => setConfirmMileage(e.target.checked)}
              />
              Yes, this mileage is correct
            </label>
          </div>
        )}
      </div>

      {/* Checks */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
          Condition Checks
        </div>
        <div className="space-y-3">
          {CHECKS.map(({ key, label }) => (
            <div key={key}>
              <div className="mb-1 text-sm font-medium">{label}</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => toggleCheck(key, true)}
                  className={`h-14 rounded-lg border text-sm font-semibold transition-colors ${
                    checks[key] === true
                      ? "border-green-500 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/40 dark:text-green-300"
                      : "border-gray-300 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
                  }`}
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => toggleCheck(key, false)}
                  className={`h-14 rounded-lg border text-sm font-semibold transition-colors ${
                    checks[key] === false
                      ? "border-red-500 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-900/40 dark:text-red-300"
                      : "border-gray-300 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
                  }`}
                >
                  Issue
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        {!notesOpen ? (
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className="text-sm text-blue-600 dark:text-blue-400"
          >
            + Add notes
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                Condition Note
              </label>
              <textarea
                value={conditionNote}
                onChange={(e) => setConditionNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                Repair Note
              </label>
              <textarea
                value={repairNote}
                onChange={(e) => setRepairNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sticky submit */}
      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="h-14 w-full rounded-lg bg-blue-600 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Inspection"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type { Rack, SlabBayState } from "./mockData";
import {
  addDefaultRacks,
  addRack,
  fetchStateFromDb,
  getSlabsByRack,
  loadState,
  saveState,
  updateRack,
} from "./storage";

export default function RackSettingsClient() {
  const [state, setState] = useState<SlabBayState>(() => loadState());
  const [selectedRackId, setSelectedRackId] = useState(
    state.racks[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [newRackName, setNewRackName] = useState("");
  const [newRackCapacity, setNewRackCapacity] = useState("7");
  const [newRackTargetFill, setNewRackTargetFill] = useState("5");
  const [newRackNote, setNewRackNote] = useState("");
  const [newRackCountToward, setNewRackCountToward] = useState(true);

  useEffect(() => {
    let active = true;
    fetchStateFromDb().then((data) => {
      if (!active || !data) return;
      setState(data);
      setSelectedRackId(data.racks[0]?.id ?? "");
      saveState(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const selectedRack = useMemo(
    () => state.racks.find((rack) => rack.id === selectedRackId),
    [state.racks, selectedRackId],
  );

  const sortedRacks = useMemo(
    () =>
      [...state.racks].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      ),
    [state.racks],
  );

  const slabsInRack = useMemo(
    () => (selectedRack ? getSlabsByRack(state, selectedRack.id) : []),
    [state, selectedRack],
  );

  const handleUpdate = (updates: Partial<Rack>) => {
    if (!selectedRack) return;
    if (
      updates.capacity !== undefined &&
      updates.capacity < slabsInRack.length
    ) {
      setError(
        `Capacity must be at least ${slabsInRack.length} to fit existing slabs.`,
      );
      return;
    }

    const nextCapacity = updates.capacity ?? selectedRack.capacity;
    if (updates.targetFill !== undefined && updates.targetFill > nextCapacity) {
      setError("Target fill cannot exceed rack capacity.");
      return;
    }
    setError(null);
    const next = updateRack(state, selectedRack.id, updates);
    setState(next);
  };

  const handleCreateRack = () => {
    const name = newRackName.trim();
    const capacity = Number(newRackCapacity);
    const targetFill = Number(newRackTargetFill);
    if (!name) {
      setError("Rack name is required.");
      return;
    }
    if (!Number.isFinite(capacity) || capacity <= 0) {
      setError("Capacity must be greater than 0.");
      return;
    }
    if (!Number.isFinite(targetFill) || targetFill <= 0) {
      setError("Target fill must be greater than 0.");
      return;
    }
    if (targetFill > capacity) {
      setError("Target fill cannot exceed rack capacity.");
      return;
    }
    const id = name.toLowerCase();
    if (state.racks.some((rack) => rack.id === id)) {
      setError("Rack ID already exists. Use a different name.");
      return;
    }

    setError(null);
    const next = addRack(state, {
      id,
      name,
      capacity,
      note: newRackNote,
      countTowardInventory: newRackCountToward,
      targetFill,
    });
    setState(next);
    setSelectedRackId(id);
    setNewRackName("");
    setNewRackCapacity("7");
    setNewRackTargetFill("5");
    setNewRackNote("");
    setNewRackCountToward(true);
  };

  const handleCreateDefaults = () => {
    const next = addDefaultRacks(state);
    setState(next);
    setSelectedRackId(next.racks[0]?.id ?? "");
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
          Rack Settings
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage rack names, capacity, and display notes.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500">
              Select rack
            </label>
            <select
              value={selectedRackId}
              onChange={(event) => setSelectedRackId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              disabled={state.racks.length === 0}
            >
              {sortedRacks.map((rack) => (
                <option key={rack.id} value={rack.id}>
                  {rack.name}
                </option>
              ))}
            </select>
            <p className="mt-3 text-xs text-gray-500">
              {state.racks.length === 0
                ? "No racks yet. Create one below."
                : `${slabsInRack.length} slabs currently assigned.`}
            </p>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Create rack
            </h3>
            <input
              value={newRackName}
              onChange={(event) => setNewRackName(event.target.value)}
              placeholder="Rack name (e.g., A1)"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                value={newRackCapacity}
                onChange={(event) => setNewRackCapacity(event.target.value)}
                placeholder="Capacity"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={1}
                value={newRackTargetFill}
                onChange={(event) => setNewRackTargetFill(event.target.value)}
                placeholder="Target fill"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
            </div>
            <textarea
              value={newRackNote}
              onChange={(event) => setNewRackNote(event.target.value)}
              placeholder="Rack note (optional)"
              rows={2}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={newRackCountToward}
                onChange={(event) =>
                  setNewRackCountToward(event.target.checked)
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              Count toward total inventory
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCreateRack}
                className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create rack
              </button>
              <button
                type="button"
                onClick={handleCreateDefaults}
                className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Create default racks
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500">
              Rack name
            </label>
            <input
              value={selectedRack?.name ?? ""}
              onChange={(event) =>
                handleUpdate({ name: event.target.value || "" })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">
              Capacity
            </label>
            <input
              type="number"
              min={1}
              value={selectedRack?.capacity ?? 0}
              onChange={(event) =>
                handleUpdate({ capacity: Number(event.target.value) })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">
              Target fill level
            </label>
            <input
              type="number"
              min={1}
              max={selectedRack?.capacity ?? 7}
              value={selectedRack?.targetFill ?? 5}
              onChange={(event) =>
                handleUpdate({ targetFill: Number(event.target.value) })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">
              Rack note
            </label>
            <textarea
              value={selectedRack?.note ?? ""}
              onChange={(event) => handleUpdate({ note: event.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={selectedRack?.countTowardInventory ?? false}
              onChange={(event) =>
                handleUpdate({ countTowardInventory: event.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300"
            />
            Count toward total inventory
          </label>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type { Rack, SlabBayState } from "./mockData";
import {
  addRack,
  deleteRackWithReassignment,
  fetchStateFromDb,
  getSlabsByRack,
  loadState,
  updateRack,
} from "./storage";

export default function RackSettingsClient() {
  const [state, setState] = useState<SlabBayState>(() => loadState());
  const [selectedRackId, setSelectedRackId] = useState(
    state.racks[0]?.id ?? "",
  );
  const [draftRack, setDraftRack] = useState<Rack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newRackName, setNewRackName] = useState("");
  const [newRackCapacity, setNewRackCapacity] = useState("7");
  const [newRackTargetFill, setNewRackTargetFill] = useState("5");
  const [newRackNote, setNewRackNote] = useState("");
  const [newRackCountToward, setNewRackCountToward] = useState(true);
  const [deleteDestinationRackId, setDeleteDestinationRackId] = useState("");

  useEffect(() => {
    let active = true;
    fetchStateFromDb().then((data) => {
      if (!active || !data) return;
      setState(data);
      setSelectedRackId(data.racks[0]?.id ?? "");
    });
    return () => {
      active = false;
    };
  }, []);

  const selectedRack = useMemo(
    () => state.racks.find((rack) => rack.id === selectedRackId),
    [state.racks, selectedRackId],
  );

  useEffect(() => {
    setDraftRack(selectedRack ? { ...selectedRack } : null);
    setError(null);
    setSuccessMessage(null);
  }, [selectedRack]);

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

  const destinationOptions = useMemo(
    () => sortedRacks.filter((rack) => rack.id !== selectedRackId),
    [sortedRacks, selectedRackId],
  );

  const handleUpdate = (updates: Partial<Rack>) => {
    setError(null);
    setSuccessMessage(null);
    setDraftRack((current) => (current ? { ...current, ...updates } : current));
  };

  const validateDraftRack = (rack: Rack) => {
    const name = rack.name.trim();
    if (!name) return "Rack name is required.";
    if (!Number.isFinite(rack.capacity) || rack.capacity <= 0) {
      return "Capacity must be greater than 0.";
    }
    if (rack.capacity < slabsInRack.length) {
      return `Capacity must be at least ${slabsInRack.length} to fit existing slabs.`;
    }
    if (!Number.isFinite(rack.targetFill) || rack.targetFill <= 0) {
      return "Target fill must be greater than 0.";
    }
    if (rack.targetFill > rack.capacity) {
      return "Target fill cannot exceed rack capacity.";
    }
    return null;
  };

  const handleSaveRack = () => {
    if (!selectedRack || !draftRack) {
      setError("Select a rack before saving changes.");
      return;
    }

    const validationError = validateDraftRack(draftRack);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const next = updateRack(state, selectedRack.id, {
        name: draftRack.name.trim(),
        capacity: draftRack.capacity,
        note: draftRack.note ?? "",
        countTowardInventory: draftRack.countTowardInventory,
        targetFill: draftRack.targetFill,
      });
      setState(next);
      setError(null);
      setSuccessMessage("Rack settings saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelRackEdits = () => {
    setDraftRack(selectedRack ? { ...selectedRack } : null);
    setError(null);
    setSuccessMessage(null);
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

  const handleDeleteRack = () => {
    if (!selectedRack) {
      setError("Select a rack to delete.");
      return;
    }

    const result = deleteRackWithReassignment(
      state,
      selectedRack.id,
      slabsInRack.length > 0 ? deleteDestinationRackId || null : null,
      "Rack Settings",
    );

    if (result.error) {
      setError(result.error);
      return;
    }

    setError(null);
    setState(result.nextState);
    setDeleteDestinationRackId("");
    const nextSelected = result.nextState.racks[0]?.id ?? "";
    setSelectedRackId(nextSelected);
  };

  const draftRackValue = draftRack ?? selectedRack;

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
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">
              Delete rack
            </h3>
            {slabsInRack.length > 0 ? (
              <>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This rack has {slabsInRack.length} slab
                  {slabsInRack.length === 1 ? "" : "s"}. Choose where to move
                  them before deleting this rack.
                </p>
                <select
                  value={deleteDestinationRackId}
                  onChange={(event) =>
                    setDeleteDestinationRackId(event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  disabled={destinationOptions.length === 0}
                >
                  <option value="">Select destination rack</option>
                  {destinationOptions.map((rack) => (
                    <option key={rack.id} value={rack.id}>
                      {rack.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This rack is empty and can be deleted directly.
              </p>
            )}
            <button
              type="button"
              onClick={handleDeleteRack}
              disabled={
                !selectedRack ||
                (slabsInRack.length > 0 && !deleteDestinationRackId)
              }
              className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              Delete rack
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          {successMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
              {successMessage}
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-500">
              Rack name
            </label>
            <input
              value={draftRackValue?.name ?? ""}
              onChange={(event) => handleUpdate({ name: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              disabled={!draftRackValue}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">
              Capacity
            </label>
            <input
              type="number"
              min={1}
              value={draftRackValue?.capacity ?? 0}
              onChange={(event) =>
                handleUpdate({ capacity: Number(event.target.value) })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              disabled={!draftRackValue}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">
              Target fill level
            </label>
            <input
              type="number"
              min={1}
              max={draftRackValue?.capacity ?? 7}
              value={draftRackValue?.targetFill ?? 5}
              onChange={(event) =>
                handleUpdate({ targetFill: Number(event.target.value) })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              disabled={!draftRackValue}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">
              Rack note
            </label>
            <textarea
              value={draftRackValue?.note ?? ""}
              onChange={(event) => handleUpdate({ note: event.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              disabled={!draftRackValue}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={draftRackValue?.countTowardInventory ?? true}
              onChange={(event) =>
                handleUpdate({ countTowardInventory: event.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300"
              disabled={!draftRackValue}
            />
            Count toward total inventory
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveRack}
              disabled={!draftRackValue || isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={handleCancelRackEdits}
              disabled={!draftRackValue || isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

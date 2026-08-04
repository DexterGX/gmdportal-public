"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  FABRICATION_SETTINGS_CATEGORIES,
  type FabricationSettingsCategory,
} from "@/lib/fabricationSettings";

type Item = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  isBuildUp?: boolean;
  [key: string]: unknown;
};

interface Props {
  initialItems: Record<FabricationSettingsCategory, Item[]>;
}

function formatValue(value: unknown, prefix?: string, suffix?: string) {
  const n = Number(value ?? 0);
  const formatted = prefix === "$" ? n.toFixed(2) : n.toString();
  return `${prefix ?? ""}${formatted}${suffix ?? ""}`;
}

const compactInput =
  "rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900";
const compactLabel = "mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400";

export default function FabricationSettingsClient({ initialItems }: Props) {
  const [activeTab, setActiveTab] = useState<FabricationSettingsCategory>("edgeTypes");
  const [items, setItems] =
    useState<Record<FabricationSettingsCategory, Item[]>>(initialItems);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [value, setValue] = useState("0");
  const [isBuildUp, setIsBuildUp] = useState(false);
  const [sortOrder, setSortOrder] = useState("0");
  const [active, setActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const config = useMemo(
    () => FABRICATION_SETTINGS_CATEGORIES.find((c) => c.category === activeTab)!,
    [activeTab],
  );

  function resetForm() {
    setEditingId(null);
    setName("");
    setValue("0");
    setIsBuildUp(false);
    setSortOrder("0");
    setActive(true);
    setError(null);
  }

  function switchTab(tab: FabricationSettingsCategory) {
    setActiveTab(tab);
    resetForm();
    setMessage(null);
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setName(item.name);
    setValue(String(item[config.dbField] ?? 0));
    setIsBuildUp(Boolean(item.isBuildUp));
    setSortOrder(String(item.sortOrder ?? 0));
    setActive(Boolean(item.active));
    setMessage(null);
    setError(null);
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      if (!name.trim()) {
        throw new Error("Name is required.");
      }
      const response = await fetch(
        `/api/fabrication-orders/settings/${config.category}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId || undefined,
            name: name.trim(),
            value: Number(value || 0),
            isBuildUp: config.hasBuildUpFlag ? isBuildUp : undefined,
            sortOrder: Number(sortOrder || 0),
            active,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || "Failed to save.");
      }

      setItems((prev) => {
        const list = prev[config.category];
        const exists = list.some((entry) => entry.id === json.id);
        return {
          ...prev,
          [config.category]: exists
            ? list.map((entry) => (entry.id === json.id ? json : entry))
            : [...list, json],
        };
      });
      setMessage(editingId ? "Updated successfully." : "Added successfully.");
      resetForm();
    } catch (err: any) {
      setError(err?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function setItemAction(
    item: Item,
    action: "activate" | "deactivate" | "delete",
  ) {
    if (
      action === "delete" &&
      !confirm(
        `Permanently delete "${item.name}"? This can't be undone. If it's used by any saved order, use Archive instead.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/fabrication-orders/settings/${config.category}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, action }),
        },
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || "Action failed.");
      }

      setItems((prev) => {
        const list = prev[config.category];
        return {
          ...prev,
          [config.category]:
            action === "delete"
              ? list.filter((entry) => entry.id !== item.id)
              : list.map((entry) => (entry.id === item.id ? json : entry)),
        };
      });
      setMessage(
        action === "delete"
          ? "Deleted."
          : action === "activate"
            ? "Restored from archive."
            : "Archived.",
      );
    } catch (err: any) {
      setError(err?.message || "Action failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Fabrication Order Settings</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Manage pricing lists used to calculate fabrication orders.
        </p>
      </div>

      {(error || message) && (
        <div
          className={`rounded-md border p-2.5 text-xs ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-1.5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap gap-1">
          {FABRICATION_SETTINGS_CATEGORIES.map((c) => (
            <button
              key={c.category}
              type="button"
              onClick={() => switchTab(c.category)}
              className={`rounded-md px-2.5 py-1 text-xs ${
                activeTab === c.category
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {config.label}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{config.description}</p>
        </div>

        <form
          onSubmit={saveItem}
          className="flex flex-wrap items-end gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-700"
        >
          <div className="w-40">
            <label className={compactLabel}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${compactInput} w-full`}
            />
          </div>
          <div className="w-24">
            <label className={compactLabel}>{config.valueLabel}</label>
            <input
              type="number"
              min="0"
              step="0.0001"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={`${compactInput} w-full`}
            />
          </div>
          <div className="w-20">
            <label className={compactLabel}>Sort</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className={`${compactInput} w-full`}
            />
          </div>
          {config.hasBuildUpFlag && (
            <label className="flex items-center gap-1.5 pb-2 text-xs">
              <input
                type="checkbox"
                checked={isBuildUp}
                onChange={(e) => setIsBuildUp(e.target.checked)}
              />
              Build-Up
            </label>
          )}
          <label className="flex items-center gap-1.5 pb-2 text-xs">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active
          </label>
          <div className="ml-auto flex gap-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs dark:border-gray-600"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Save" : "Add"}
            </button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-[10px] uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="py-1.5 pr-3">Name</th>
                <th className="py-1.5 pr-3">{config.valueLabel}</th>
                {config.hasBuildUpFlag && <th className="py-1.5 pr-3">Build-Up</th>}
                <th className="py-1.5 pr-3">Sort</th>
                <th className="py-1.5 pr-3">Status</th>
                <th className="py-1.5 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items[config.category].length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-3 text-xs text-gray-500 dark:text-gray-400">
                    No entries yet.
                  </td>
                </tr>
              ) : (
                [...items[config.category]]
                  .sort((a, b) =>
                    a.sortOrder !== b.sortOrder
                      ? a.sortOrder - b.sortOrder
                      : a.name.localeCompare(b.name),
                  )
                  .map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700/60">
                      <td className="py-1.5 pr-3">{item.name}</td>
                      <td className="py-1.5 pr-3">
                        {formatValue(item[config.dbField], config.valuePrefix, config.valueSuffix)}
                      </td>
                      {config.hasBuildUpFlag && (
                        <td className="py-1.5 pr-3">{item.isBuildUp ? "Yes" : "No"}</td>
                      )}
                      <td className="py-1.5 pr-3">{item.sortOrder}</td>
                      <td className="py-1.5 pr-3">
                        {item.active ? (
                          <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            Archived
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="mr-2 text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        {item.active ? (
                          <button
                            type="button"
                            onClick={() => setItemAction(item, "deactivate")}
                            className="mr-2 text-amber-600 hover:underline"
                          >
                            Archive
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setItemAction(item, "activate")}
                            className="mr-2 text-green-600 hover:underline"
                          >
                            Restore
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setItemAction(item, "delete")}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

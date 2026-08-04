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

type PriceLogEntry = {
  id: string;
  entityType: string;
  entityName: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  changedByUser: { name: string | null; email: string | null } | null;
};

interface Props {
  initialItems: Record<FabricationSettingsCategory, Item[]>;
  initialPriceLog: PriceLogEntry[];
}

function formatValue(value: unknown, prefix?: string, suffix?: string) {
  const n = Number(value ?? 0);
  const formatted = prefix === "$" ? n.toFixed(2) : n.toString();
  return `${prefix ?? ""}${formatted}${suffix ?? ""}`;
}

export default function FabricationSettingsClient({
  initialItems,
  initialPriceLog,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    FabricationSettingsCategory | "priceLog"
  >("edgeTypes");
  const [items, setItems] =
    useState<Record<FabricationSettingsCategory, Item[]>>(initialItems);
  const [priceLog] = useState<PriceLogEntry[]>(initialPriceLog);

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
    () =>
      activeTab === "priceLog"
        ? null
        : FABRICATION_SETTINGS_CATEGORIES.find((c) => c.category === activeTab)!,
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

  function switchTab(tab: FabricationSettingsCategory | "priceLog") {
    setActiveTab(tab);
    resetForm();
    setMessage(null);
  }

  function startEdit(item: Item) {
    if (!config) return;
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
    if (!config) return;
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
    if (!config) return;
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Fabrication Order Settings</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Manage pricing lists used to calculate fabrication orders. Editing a
          price is logged below for reference.
        </p>
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

      <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap gap-2">
          {FABRICATION_SETTINGS_CATEGORIES.map((c) => (
            <button
              key={c.category}
              type="button"
              onClick={() => switchTab(c.category)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                activeTab === c.category
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => switchTab("priceLog")}
            className={`rounded-md px-3 py-1.5 text-sm ${
              activeTab === "priceLog"
                ? "bg-blue-600 text-white"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Price Change Log
          </button>
        </div>
      </div>

      {activeTab === "priceLog" || !config ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Price Change Log
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">List</th>
                  <th className="py-2 pr-4">Item</th>
                  <th className="py-2 pr-4">Field</th>
                  <th className="py-2 pr-4">Old Value</th>
                  <th className="py-2 pr-4">New Value</th>
                  <th className="py-2 pr-4">Changed By</th>
                </tr>
              </thead>
              <tbody>
                {priceLog.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-4 text-sm text-gray-500 dark:text-gray-400"
                    >
                      No price changes logged yet.
                    </td>
                  </tr>
                ) : (
                  priceLog.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-gray-100 dark:border-gray-700/60"
                    >
                      <td className="py-2 pr-4">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">{entry.entityType}</td>
                      <td className="py-2 pr-4">{entry.entityName}</td>
                      <td className="py-2 pr-4">{entry.fieldName}</td>
                      <td className="py-2 pr-4">{entry.oldValue ?? "-"}</td>
                      <td className="py-2 pr-4">{entry.newValue ?? "-"}</td>
                      <td className="py-2 pr-4">
                        {entry.changedByUser?.name ||
                          entry.changedByUser?.email ||
                          "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {config.label}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {config.description}
            </p>
          </div>

          <form
            onSubmit={saveItem}
            className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
          >
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {editingId ? `Edit ${config.label}` : `New ${config.label}`}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {config.valueLabel}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                />
              </div>
              <div className="flex flex-col justify-end gap-2 pb-2">
                {config.hasBuildUpFlag && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isBuildUp}
                      onChange={(e) => setIsBuildUp(e.target.checked)}
                    />
                    Build-Up pricing
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Save Changes" : "Add"}
              </button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">{config.valueLabel}</th>
                  {config.hasBuildUpFlag && (
                    <th className="py-2 pr-4">Build-Up</th>
                  )}
                  <th className="py-2 pr-4">Sort</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items[config.category].length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-4 text-sm text-gray-500 dark:text-gray-400"
                    >
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
                      <tr
                        key={item.id}
                        className="border-b border-gray-100 dark:border-gray-700/60"
                      >
                        <td className="py-2 pr-4">{item.name}</td>
                        <td className="py-2 pr-4">
                          {formatValue(
                            item[config.dbField],
                            config.valuePrefix,
                            config.valueSuffix,
                          )}
                        </td>
                        {config.hasBuildUpFlag && (
                          <td className="py-2 pr-4">
                            {item.isBuildUp ? "Yes" : "No"}
                          </td>
                        )}
                        <td className="py-2 pr-4">{item.sortOrder}</td>
                        <td className="py-2 pr-4">
                          {item.active ? (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-300">
                              Active
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              Archived
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="mr-3 text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          {item.active ? (
                            <button
                              type="button"
                              onClick={() => setItemAction(item, "deactivate")}
                              className="mr-3 text-amber-600 hover:underline"
                            >
                              Archive
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setItemAction(item, "activate")}
                              className="mr-3 text-green-600 hover:underline"
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
      )}
    </div>
  );
}

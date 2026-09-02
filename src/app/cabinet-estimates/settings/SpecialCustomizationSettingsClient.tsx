"use client";

import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/cabinetEstimateCalc";

type Item = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
};

type Props = {
  initialItems: Item[];
};

export default function SpecialCustomizationSettingsClient({ initialItems }: Props) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateItem(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function saveItem(item: Item) {
    setSavingId(item.id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/cabinet-estimates/special-customization-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          price: item.price,
          isActive: item.isActive,
          sortOrder: item.sortOrder,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save item");
      setMessage(`"${item.name}" saved.`);
    } catch (err: any) {
      setError(err?.message || "Failed to save item");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteItem(item: Item) {
    if (!confirm(`Delete "${item.name}"? This can't be undone.`)) return;
    setDeletingId(item.id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/cabinet-estimates/special-customization-items/${item.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to delete item");
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setMessage(`"${item.name}" deleted.`);
    } catch (err: any) {
      setError(err?.message || "Failed to delete item");
    } finally {
      setDeletingId(null);
    }
  }

  async function addItem() {
    const name = newName.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    setCreating(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/cabinet-estimates/special-customization-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price: newPrice }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to add item");
      setItems((prev) => [...prev, json]);
      setNewName("");
      setNewPrice(0);
      setMessage(`"${name}" added.`);
    } catch (err: any) {
      setError(err?.message || "Failed to add item");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Special Customization Settings
        </h1>
        <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
          Manage the customization types and prices available on the Cabinet Estimate
          form&apos;s Special Customization section. Deactivate an item instead of
          deleting it if it&apos;s already been used on a saved estimate.
        </p>
      </div>

      {(error || message) && (
        <div
          className={`rounded-md border p-3 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              : "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="rounded-xl border border-gray-300 bg-white p-4 dark:border-gray-600 dark:bg-gray-800">
        <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Add a new customization type
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Name
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Island Back Panel"
              className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="w-32">
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Price
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={newPrice}
              onChange={(e) => setNewPrice(Number(e.target.value) || 0)}
              className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <button
            type="button"
            onClick={addItem}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> {creating ? "Adding..." : "Add Item"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 text-xs uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                <th className="w-20 border border-gray-300 px-2 py-2 text-center dark:border-gray-600">
                  Sort
                </th>
                <th className="border border-gray-300 px-2 py-2 text-left dark:border-gray-600">
                  Name
                </th>
                <th className="w-32 border border-gray-300 px-2 py-2 text-right dark:border-gray-600">
                  Price
                </th>
                <th className="w-20 border border-gray-300 px-2 py-2 text-center dark:border-gray-600">
                  Active
                </th>
                <th className="w-28 border border-gray-300 px-2 py-2 dark:border-gray-600" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="border border-gray-200 px-3 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
                  >
                    No customization types yet - add one above.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700">
                    <td className="border border-gray-200 p-1 dark:border-gray-700">
                      <input
                        type="number"
                        value={item.sortOrder}
                        onChange={(e) =>
                          updateItem(item.id, { sortOrder: Number(e.target.value) || 0 })
                        }
                        className="w-full bg-transparent px-1.5 py-1 text-center text-sm text-gray-900 outline-none dark:text-gray-100"
                      />
                    </td>
                    <td className="border border-gray-200 p-1 dark:border-gray-700">
                      <input
                        value={item.name}
                        onChange={(e) => updateItem(item.id, { name: e.target.value })}
                        className="w-full bg-transparent px-1.5 py-1 text-sm text-gray-900 outline-none dark:text-gray-100"
                      />
                    </td>
                    <td className="border border-gray-200 p-1 dark:border-gray-700">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">
                          $
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.price}
                          onChange={(e) =>
                            updateItem(item.id, { price: Number(e.target.value) || 0 })
                          }
                          className="w-full bg-transparent py-1 pl-4 pr-1 text-right text-sm text-gray-900 outline-none dark:text-gray-100"
                        />
                      </div>
                    </td>
                    <td className="border border-gray-200 p-1 text-center dark:border-gray-700">
                      <input
                        type="checkbox"
                        checked={item.isActive}
                        onChange={(e) => updateItem(item.id, { isActive: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                      />
                    </td>
                    <td className="border border-gray-200 p-1 dark:border-gray-700">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => saveItem(item)}
                          disabled={savingId === item.id}
                          className="inline-flex items-center justify-center rounded p-1.5 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-blue-950/40"
                          title="Save"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteItem(item)}
                          disabled={deletingId === item.id}
                          className="inline-flex items-center justify-center rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/40"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {items.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {items.filter((i) => i.isActive).length} of {items.length} active -{" "}
          {formatCurrency(items.reduce((sum, i) => sum + i.price, 0))} combined price of all
          items listed above.
        </p>
      )}
    </div>
  );
}

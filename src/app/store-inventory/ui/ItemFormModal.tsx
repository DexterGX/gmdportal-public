"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { StoreItem, StoreTaxonomy } from "../types";

export type StoreItemFormValues = {
  name: string;
  departmentId: string;
  groupId: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  recommendedQuantity: number;
  purchaseLink: string;
  notes: string;
  providerId: string;
  providerSku: string;
  providerCost: string;
};

export type ProviderOption = { id: string; name: string };

interface Props {
  item: StoreItem | null;
  departments: StoreTaxonomy[];
  groups: StoreTaxonomy[];
  providers: ProviderOption[];
  onClose: () => void;
  onSave: (values: StoreItemFormValues) => Promise<void> | void;
}

export default function ItemFormModal({ item, departments, groups, providers, onClose, onSave }: Props) {
  const linkedProvider = item?.providers.find((p) => p.isPreferred) ?? item?.providers[0] ?? null;

  const [form, setForm] = useState<StoreItemFormValues>({
    name: item?.name ?? "",
    departmentId: item?.departmentId ?? "",
    groupId: item?.groupId ?? "",
    unit: item?.unit ?? "each",
    quantity: item?.quantity ?? 0,
    minQuantity: item?.minQuantity ?? 0,
    recommendedQuantity: item?.recommendedQuantity ?? 0,
    purchaseLink: item?.purchaseLink ?? "",
    notes: item?.notes ?? "",
    providerId: linkedProvider?.providerId ?? "",
    providerSku: linkedProvider?.providerSku ?? "",
    providerCost: linkedProvider?.cost != null ? String(linkedProvider.cost) : "",
  });
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof StoreItemFormValues>(key: K, value: StoreItemFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {item ? "Edit Item" : "Add New Item"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Item Name</label>
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Propane Gas Tank"
              className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Department</label>
              <select
                value={form.departmentId}
                onChange={(e) => update("departmentId", e.target.value)}
                className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Group</label>
              <select
                value={form.groupId}
                onChange={(e) => update("groupId", e.target.value)}
                className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="">—</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Unit</label>
              <input
                value={form.unit}
                onChange={(e) => update("unit", e.target.value)}
                placeholder="each"
                className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Qty</label>
              <input
                type="number"
                value={form.quantity}
                disabled={Boolean(item)}
                onChange={(e) => update("quantity", Number(e.target.value))}
                className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Min</label>
              <input
                type="number"
                value={form.minQuantity}
                onChange={(e) => update("minQuantity", Number(e.target.value))}
                className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Recommended</label>
              <input
                type="number"
                value={form.recommendedQuantity}
                onChange={(e) => update("recommendedQuantity", Number(e.target.value))}
                className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          {item && (
            <p className="text-[11px] text-gray-500 dark:text-gray-500 -mt-2">
              Quantity can only change through Check Out or a received Restock Request, so it can&apos;t be edited here.
            </p>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Purchase Link</label>
            <input
              value={form.purchaseLink}
              onChange={(e) => update("purchaseLink", e.target.value)}
              placeholder="https://..."
              className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Provider (optional)</label>
            <select
              value={form.providerId}
              onChange={(e) => update("providerId", e.target.value)}
              className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="">— No provider —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {providers.length === 0 && (
              <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-1">
                No providers yet — add one from the Providers directory first.
              </p>
            )}
            {form.providerId && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Provider SKU</label>
                  <input
                    value={form.providerSku}
                    onChange={(e) => update("providerSku", e.target.value)}
                    className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Cost</label>
                  <input
                    type="number"
                    value={form.providerCost}
                    onChange={(e) => update("providerCost", e.target.value)}
                    className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={2}
              className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

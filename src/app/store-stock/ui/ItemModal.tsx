"use client";
import React, { useState } from "react";

import type { StockItem } from "./StockManager";

export default function ItemModal({
  onClose,
  onSave,
  item,
}: {
  onClose: () => void;
  onSave: (payload: any) => Promise<void> | void;
  item: StockItem | null;
}) {
  const [form, setForm] = useState(() => ({
    id: item?.id,
    name: item?.name ?? "",
    category: item?.category ?? "",
    unit: item?.unit ?? "",
    quantity: item?.quantity ?? 0,
    minQuantity: item?.minQuantity ?? 0,
    providor: item?.providor ?? "",
    notes: item?.notes ?? "",
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold mb-4">
          {item ? "Edit Item" : "Add New Item"}
        </h2>

        <div className="grid grid-cols-1 gap-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name"
            className="p-2 border rounded"
          />
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Category"
            className="p-2 border rounded"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="Unit"
              className="p-2 border rounded"
            />
            <input
              type="number"
              value={form.quantity}
              onChange={(e) =>
                setForm({ ...form, quantity: Number(e.target.value) })
              }
              placeholder="Quantity"
              className="p-2 border rounded"
            />
            <input
              type="number"
              value={form.minQuantity}
              onChange={(e) =>
                setForm({ ...form, minQuantity: Number(e.target.value) })
              }
              placeholder="Min Qty"
              className="p-2 border rounded"
            />
          </div>
          <input
            value={form.providor}
            onChange={(e) => setForm({ ...form, providor: e.target.value })}
            placeholder="Providor"
            className="p-2 border rounded"
          />
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes"
            className="p-2 border rounded"
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1 rounded border">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-3 py-1 rounded bg-sky-600 text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

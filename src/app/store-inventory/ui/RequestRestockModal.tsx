"use client";

import { useState } from "react";
import { X, RotateCcw } from "lucide-react";
import type { StoreItem } from "../types";

interface Props {
  item: StoreItem;
  onClose: () => void;
  onSubmit: (requestedQty: number, notes: string) => Promise<void> | void;
}

export default function RequestRestockModal({ item, onClose, onSubmit }: Props) {
  const suggested = Math.max(item.recommendedQuantity - item.quantity, item.minQuantity || 1);
  const [requestedQty, setRequestedQty] = useState<number | "">(suggested > 0 ? suggested : 1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isInvalid = requestedQty === "" || requestedQty <= 0;

  async function handleSubmit() {
    if (isInvalid) return;
    setSubmitting(true);
    try {
      await onSubmit(requestedQty as number, notes);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-purple-600" />
            Request Restock
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {item.name} — currently <span className="font-medium">{item.quantity}</span> {item.unit}{" "}
          (recommended {item.recommendedQuantity})
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Quantity requested</label>
            <input
              type="number"
              min={1}
              value={requestedQty}
              onChange={(e) => setRequestedQty(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            disabled={submitting || isInvalid}
            className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

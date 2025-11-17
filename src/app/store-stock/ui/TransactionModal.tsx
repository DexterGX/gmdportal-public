"use client";
import React, { useState } from "react";
import type { StockItem } from "./StockManager";

export default function TransactionModal({
  onClose,
  onSubmit,
  item,
}: {
  onClose: () => void;
  onSubmit: (data: {
    itemId: string;
    change: number;
    reason?: string;
  }) => void | Promise<void>;
  item: StockItem;
}) {
  const [change, setChange] = useState(0);
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-2">
          Adjust Stock — {item.name}
        </h2>

        <div className="grid gap-2">
          <input
            type="number"
            value={change}
            onChange={(e) => setChange(Number(e.target.value))}
            className="p-2 border rounded"
            placeholder="Change (positive to add, negative to remove)"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason / Notes"
            className="p-2 border rounded"
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1 rounded border">
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ itemId: item.id, change, reason })}
            className="px-3 py-1 rounded bg-sky-600 text-white"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

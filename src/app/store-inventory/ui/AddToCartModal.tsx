"use client";

import { useState } from "react";
import { X, ShoppingCart } from "lucide-react";
import type { StoreItem } from "../types";

interface Props {
  item: StoreItem;
  initialQuantity?: number;
  initialReason?: string;
  onClose: () => void;
  onSubmit: (quantity: number, reason: string) => void;
}

export default function AddToCartModal({ item, initialQuantity, initialReason, onClose, onSubmit }: Props) {
  const [quantity, setQuantity] = useState(initialQuantity ?? 1);
  const [reason, setReason] = useState(initialReason ?? "");

  const exceedsStock = quantity > item.quantity;

  function handleSubmit() {
    if (quantity <= 0 || exceedsStock) return;
    onSubmit(quantity, reason);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Add to Cart
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {item.name} — <span className="font-medium">{item.quantity}</span> {item.unit} available
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Quantity</label>
            <input
              type="number"
              min={1}
              max={item.quantity}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            {exceedsStock && (
              <p className="text-xs text-red-600 mt-1">Only {item.quantity} {item.unit} available.</p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Reason / Job (optional)
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Job #1234 install"
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
            disabled={quantity <= 0 || exceedsStock}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

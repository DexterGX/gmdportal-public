"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { addAccessoryItem } from "@/lib/accessories";
import type {
  AccessoryCategory,
  AccessoryItemStatus,
} from "@prisma/client";

interface Props {
  trackerId: string;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddItemModal({
  trackerId,
  userId,
  onClose,
  onSuccess,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [items, setItems] = useState<
    Array<{
      category: AccessoryCategory;
      customName: string;
      quantity: string;
      status: AccessoryItemStatus;
    }>
  >([
    {
      category: "OTHER",
      customName: "",
      quantity: "",
      status: "READY_TO_ORDER",
    },
  ]);

  const getCategoryLabel = (category: AccessoryCategory) => {
    const labels: Record<AccessoryCategory, string> = {
      HANDLE: "Handle",
      PULLOUT: "Pullout",
      TRIM: "Trim",
      HARDWARE: "Hardware",
      SINK: "Sink",
      FAUCET: "Faucet",
      APPLIANCE: "Appliance",
      LIGHTING: "Lighting",
      OTHER: "Other",
    };
    return labels[category] || category;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const missingOtherName = items.find(
      (item) => item.category === "OTHER" && !item.customName.trim()
    );
    if (missingOtherName) {
      setError("Please provide a name for items marked as Other.");
      return;
    }

    const invalidQuantity = items.find((item) => {
      const qty = parseInt(item.quantity || "", 10);
      return !Number.isFinite(qty) || qty < 1;
    });
    if (invalidQuantity) {
      setError("Please enter a quantity of at least 1 for all items.");
      return;
    }

    setSubmitting(true);

    try {
      await Promise.all(
        items.map((item) =>
          addAccessoryItem(trackerId, {
            category: item.category,
            name:
              item.category === "OTHER"
                ? item.customName.trim()
                : getCategoryLabel(item.category),
            quantity: parseInt(item.quantity, 10),
            status: item.status,
            createdByUserId: userId,
          })
        )
      );

      onSuccess();
    } catch (error: any) {
      console.error("Error adding item:", error);
      setError(error.message || "Failed to add item");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold">Add Accessory Item</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-800 dark:text-red-300">
                {error}
              </div>
            )}
            {/* Items */}
            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="border border-gray-200 dark:border-gray-700 rounded-md p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Item {index + 1}
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setItems((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Category
                      </label>
                      <select
                        value={item.category}
                        onChange={(e) => {
                          const value = e.target.value as AccessoryCategory;
                          setItems((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? { ...row, category: value }
                                : row
                            )
                          );
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="HANDLE">Handle</option>
                        <option value="PULLOUT">Pullout</option>
                        <option value="TRIM">Trim</option>
                        <option value="HARDWARE">Hardware</option>
                        <option value="SINK">Sink</option>
                        <option value="FAUCET">Faucet</option>
                        <option value="APPLIANCE">Appliance</option>
                        <option value="LIGHTING">Lighting</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? {
                                    ...row,
                                    quantity: e.target.value,
                                  }
                                : row
                            )
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {item.category === "OTHER" && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Specify Item Name
                      </label>
                      <input
                        type="text"
                        value={item.customName}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? { ...row, customName: e.target.value }
                                : row
                            )
                          )
                        }
                        placeholder="e.g., Rev-A-Shelf 35qt trash pullout"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Initial Status
                    </label>
                    <select
                      value={item.status}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row, i) =>
                            i === index
                              ? {
                                  ...row,
                                  status: e.target.value as AccessoryItemStatus,
                                }
                              : row
                          )
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="PENDING_REMEASURE_APPROVAL">
                        Pending Remeasure
                      </option>
                      <option value="READY_TO_ORDER">Ready to Order</option>
                      <option value="ORDERED">Ordered</option>
                      <option value="IN_TRANSIT">In Transit</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="CHECKED_IN">Checked In</option>
                      <option value="INSTALLED">Installed</option>
                      <option value="NOT_NEEDED">Not Needed</option>
                      <option value="ISSUE">Issue</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  {
                    category: "OTHER",
                    customName: "",
                    quantity: "",
                    status: "READY_TO_ORDER",
                  },
                ])
              }
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Plus className="w-4 h-4" />
              Add Another Item
            </button>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {submitting ? "Adding..." : `Add ${items.length} Item${items.length > 1 ? "s" : ""}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

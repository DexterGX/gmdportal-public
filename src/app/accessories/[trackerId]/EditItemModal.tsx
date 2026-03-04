"use client";

import { useState } from "react";
import { X, Save } from "lucide-react";
import {
  updateAccessoryItem,
  changeAccessoryItemStatus,
} from "@/lib/accessories";
import type { AccessoryCategory, AccessoryItemStatus } from "@prisma/client";

interface Props {
  item: any;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditItemModal({
  item,
  userId,
  onClose,
  onSuccess,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"details" | "status">("details");

  // Form fields for details
  const [category, setCategory] = useState<AccessoryCategory>(item.category);
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(
    item.quantity ? String(item.quantity) : ""
  );
  const [etaAt, setEtaAt] = useState(
    item.etaAt ? new Date(item.etaAt).toISOString().split("T")[0] : ""
  );

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

  // Form fields for status change
  const [status, setStatus] = useState<AccessoryItemStatus>(item.status);
  const [statusNote, setStatusNote] = useState("");
  const [orderedAt, setOrderedAt] = useState(
    item.orderedAt ? new Date(item.orderedAt).toISOString().split("T")[0] : ""
  );
  const [deliveredAt, setDeliveredAt] = useState(
    item.deliveredAt
      ? new Date(item.deliveredAt).toISOString().split("T")[0]
      : ""
  );
  const [checkedInAt, setCheckedInAt] = useState(
    item.checkedInAt
      ? new Date(item.checkedInAt).toISOString().split("T")[0]
      : ""
  );
  const [installedAt, setInstalledAt] = useState(
    item.installedAt
      ? new Date(item.installedAt).toISOString().split("T")[0]
      : ""
  );

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (category === "OTHER" && !name.trim()) {
      setError("Item name is required for Other category");
      return;
    }

    const qty = parseInt(quantity || "", 10);
    if (!Number.isFinite(qty) || qty < 1) {
      setError("Quantity must be at least 1");
      return;
    }

    setSubmitting(true);

    try {
      await updateAccessoryItem(item.id, {
        category,
        name:
          category === "OTHER" ? name.trim() : getCategoryLabel(category),
        quantity: qty,
        etaAt: etaAt ? new Date(etaAt) : null,
        updatedByUserId: userId,
      });

      onSuccess();
    } catch (error: any) {
      console.error("Error updating item:", error);
      setError(error.message || "Failed to update item");
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await changeAccessoryItemStatus(item.id, status, userId, {
        note: statusNote.trim() || undefined,
        orderedAt: orderedAt ? new Date(orderedAt) : undefined,
        deliveredAt: deliveredAt ? new Date(deliveredAt) : undefined,
        checkedInAt: checkedInAt ? new Date(checkedInAt) : undefined,
        installedAt: installedAt ? new Date(installedAt) : undefined,
        etaAt: etaAt ? new Date(etaAt) : undefined,
      });

      onSuccess();
    } catch (error: any) {
      console.error("Error updating status:", error);
      setError(error.message || "Failed to update status");
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
            <h2 className="text-xl font-semibold">Edit Item</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab("details")}
              className={`flex-1 px-6 py-3 text-sm font-medium ${
                activeTab === "details"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Item Details
            </button>
            <button
              onClick={() => setActiveTab("status")}
              className={`flex-1 px-6 py-3 text-sm font-medium ${
                activeTab === "status"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Status & Dates
            </button>
          </div>

          {error && (
            <div className="m-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Details Tab */}
          {activeTab === "details" && (
            <form onSubmit={handleUpdateDetails} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as AccessoryCategory)
                    }
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
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {category === "OTHER" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Item Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expected Arrival (ETA)
                </label>
                <input
                  type="date"
                  value={etaAt}
                  onChange={(e) => setEtaAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

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
                  <Save className="w-4 h-4" />
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}

          {/* Status Tab */}
          {activeTab === "status" && (
            <form onSubmit={handleUpdateStatus} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as AccessoryItemStatus)
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

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status Note (optional)
                </label>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  rows={2}
                  placeholder="Add a note about this status change..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ordered Date
                  </label>
                  <input
                    type="date"
                    value={orderedAt}
                    onChange={(e) => setOrderedAt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Delivered Date
                  </label>
                  <input
                    type="date"
                    value={deliveredAt}
                    onChange={(e) => setDeliveredAt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Checked In Date
                  </label>
                  <input
                    type="date"
                    value={checkedInAt}
                    onChange={(e) => setCheckedInAt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Installed Date
                  </label>
                  <input
                    type="date"
                    value={installedAt}
                    onChange={(e) => setInstalledAt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

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
                  <Save className="w-4 h-4" />
                  {submitting ? "Saving..." : "Update Status"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

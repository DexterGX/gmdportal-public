"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Calendar,
  User,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  AlertCircle,
  Clock,
  CheckCircle,
  Package,
  Truck,
  Home,
  XCircle,
  MessageSquare,
} from "lucide-react";
import {
  updateAccessoryTracker,
  addAccessoryItem,
  updateAccessoryItem,
  changeAccessoryItemStatus,
  deleteAccessoryItem,
  addAccessoryItemNote,
  getAccessoryTracker,
  deleteAccessoryTracker,
} from "@/lib/accessories";
import type {
  AccessoryItemStatus,
  AccessoryCategory,
  AccessoryDepartment,
} from "@prisma/client";

// Import types from lib
import type {
  AccessoryTrackerWithRelations,
  AccessoryItemWithUser,
} from "@/lib/accessories";

// Import modal components
import AddItemModal from "./AddItemModal";
import EditItemModal from "./EditItemModal";

interface Props {
  tracker: any;
  userId: string;
  userRole: string;
}

export default function AccessoryTrackerDetailClient({
  tracker: initialTracker,
  userId,
  userRole,
}: Props) {
  const router = useRouter();
  const [tracker, setTracker] = useState(initialTracker);
  const [loading, setLoading] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [showEditTrackerModal, setShowEditTrackerModal] = useState(false);
  const [trackerForm, setTrackerForm] = useState({
    invoiceNumber: tracker.invoiceNumber || "",
    invoiceCreatedAt: tracker.invoiceCreatedAt
      ? new Date(tracker.invoiceCreatedAt).toISOString().split("T")[0]
      : "",
    remeasureApprovedAt: tracker.remeasureApprovedAt
      ? new Date(tracker.remeasureApprovedAt).toISOString().split("T")[0]
      : "",
    department: tracker.department || "",
    notes: tracker.notes || "",
  });

  const handleSaveTracker = async () => {
    try {
      await updateAccessoryTracker(tracker.id, {
        invoiceNumber: trackerForm.invoiceNumber.trim() || null,
        invoiceCreatedAt: trackerForm.invoiceCreatedAt
          ? new Date(trackerForm.invoiceCreatedAt)
          : null,
        remeasureApprovedAt: trackerForm.remeasureApprovedAt
          ? new Date(trackerForm.remeasureApprovedAt)
          : null,
        department: trackerForm.department || null,
        notes: trackerForm.notes || null,
        updatedByUserId: userId,
      });
      setShowEditTrackerModal(false);
      refreshTracker();
    } catch (error) {
      console.error("Error updating tracker:", error);
    }
  };
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showItemHistory, setShowItemHistory] = useState(false);

  const canEdit = ["admin", "office", "finance"].includes(userRole);

  const refreshTracker = async () => {
    try {
      const updated = await getAccessoryTracker(tracker.id);
      setTracker(updated);
    } catch (error) {
      console.error("Error refreshing tracker:", error);
    }
  };

  const getStatusBadge = (status: AccessoryItemStatus) => {
    const configs: Record<
      AccessoryItemStatus,
      { bg: string; text: string; icon: any }
    > = {
      PENDING_REMEASURE_APPROVAL: {
        bg: "bg-gray-100 dark:bg-gray-900/30",
        text: "text-gray-800 dark:text-gray-300",
        icon: Clock,
      },
      READY_TO_ORDER: {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-800 dark:text-blue-300",
        icon: Package,
      },
      ORDERED: {
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        text: "text-yellow-800 dark:text-yellow-300",
        icon: CheckCircle,
      },
      IN_TRANSIT: {
        bg: "bg-purple-100 dark:bg-purple-900/30",
        text: "text-purple-800 dark:text-purple-300",
        icon: Truck,
      },
      DELIVERED: {
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-800 dark:text-green-300",
        icon: CheckCircle,
      },
      CHECKED_IN: {
        bg: "bg-teal-100 dark:bg-teal-900/30",
        text: "text-teal-800 dark:text-teal-300",
        icon: CheckCircle,
      },
      INSTALLED: {
        bg: "bg-gray-100 dark:bg-gray-900/30",
        text: "text-gray-800 dark:text-gray-300",
        icon: Home,
      },
      NOT_NEEDED: {
        bg: "bg-gray-100 dark:bg-gray-900/30",
        text: "text-gray-600 dark:text-gray-400",
        icon: XCircle,
      },
      ISSUE: {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-800 dark:text-red-300",
        icon: AlertCircle,
      },
    };

    const config = configs[status];
    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
      >
        <Icon className="w-3 h-3" />
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  const needsAttention = (item: any) => {
    return (
      item.status === "ISSUE" ||
      (item.etaAt &&
        new Date(item.etaAt) < new Date() &&
        !["DELIVERED", "CHECKED_IN", "INSTALLED", "NOT_NEEDED"].includes(
          item.status,
        ))
    );
  };

  const handleStatusChange = async (
    itemId: string,
    newStatus: AccessoryItemStatus,
  ) => {
    let note: string | undefined;
    if (newStatus === "ISSUE" || newStatus === "NOT_NEEDED") {
      const response = window.prompt(
        `Please add a note for status: ${newStatus.replace(/_/g, " ")}`,
      );
      if (response === null) return;
      note = response.trim() || undefined;
    }

    try {
      await changeAccessoryItemStatus(itemId, newStatus, userId, {
        note,
      });
      refreshTracker();
    } catch (error) {
      console.error("Error changing status:", error);
    }
  };

  const handleDeleteTracker = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this tracker? This will archive all items.",
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      await deleteAccessoryTracker(tracker.id, userId);
      router.push("/accessories");
    } catch (error) {
      console.error("Error deleting tracker:", error);
      alert("Failed to delete tracker");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/accessories")}
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Trackers
        </button>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Job #{tracker.job.jobNumber} - {tracker.job.jobName}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {tracker.job.customer.displayName}
            </p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowEditTrackerModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={loading}
              >
                <Edit2 className="w-4 h-4" />
                Edit Tracker
              </button>
              <button
                onClick={handleDeleteTracker}
                className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                disabled={loading}
              >
                <Trash2 className="w-4 h-4" />
                Delete Tracker
              </button>
              <button
                onClick={() => setShowAddItemModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                disabled={loading}
              >
                <Plus className="w-5 h-5" />
                Add Item
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tracker Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Customer Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Customer Info</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Name:</span>
              <div className="font-medium">
                {tracker.job.customer.displayName}
              </div>
            </div>
            {tracker.job.customer.phone && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Phone:</span>
                <div className="font-medium">{tracker.job.customer.phone}</div>
              </div>
            )}
            {tracker.job.customer.email && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Email:</span>
                <div className="font-medium">{tracker.job.customer.email}</div>
              </div>
            )}
          </div>
        </div>

        {/* Milestone Dates */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Milestone Dates</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-gray-500 dark:text-gray-400">
                  Invoice Created
                </div>
                <div className="font-medium">
                  {tracker.invoiceCreatedAt
                    ? new Date(tracker.invoiceCreatedAt).toLocaleDateString()
                    : "Not set"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-gray-500 dark:text-gray-400">
                  Remeasure Approved
                </div>
                <div className="font-medium">
                  {tracker.remeasureApprovedAt
                    ? new Date(tracker.remeasureApprovedAt).toLocaleDateString()
                    : "Not set"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">
                Total Items:
              </span>
              <span className="font-medium">{tracker.items.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">
                Invoice #:
              </span>
              <span className="font-medium">
                {tracker.invoiceNumber || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">
                Department:
              </span>
              <span className="font-medium">
                {tracker.department || "Not specified"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">
                Last Updated:
              </span>
              <span className="font-medium">
                {new Date(tracker.updatedAt).toLocaleDateString()}
              </span>
            </div>
            {tracker.notes && (
              <div className="pt-2">
                <div className="text-gray-500 dark:text-gray-400">Notes:</div>
                <div className="text-gray-900 dark:text-gray-100">
                  {tracker.notes}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">Accessory Items</h2>
        </div>

        {tracker.items.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No items added yet
            </p>
            {canEdit && (
              <button
                onClick={() => setShowAddItemModal(true)}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                Add your first item
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      ETA
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {tracker.items.map((item: any) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors ${
                        needsAttention(item)
                          ? "bg-red-50 dark:bg-red-900/10"
                          : ""
                      }`}
                    >
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-start gap-2">
                          {needsAttention(item) && (
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {item.name}
                            </div>
                            {item.sku && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                SKU: {item.sku}
                              </div>
                            )}
                            {item.linkUrl && (
                              <a
                                href={item.linkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1 mt-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Link
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 text-center">
                        {item.category.replace(/_/g, " ")}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 text-center">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {canEdit ? (
                          <select
                            value={item.status}
                            onChange={(e) =>
                              handleStatusChange(
                                item.id,
                                e.target.value as AccessoryItemStatus,
                              )
                            }
                            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="PENDING_REMEASURE_APPROVAL">
                              Pending Remeasure
                            </option>
                            <option value="READY_TO_ORDER">
                              Ready to Order
                            </option>
                            <option value="ORDERED">Ordered</option>
                            <option value="IN_TRANSIT">In Transit</option>
                            <option value="DELIVERED">Delivered</option>
                            <option value="CHECKED_IN">Checked In</option>
                            <option value="INSTALLED">Installed</option>
                            <option value="NOT_NEEDED">Not Needed</option>
                            <option value="ISSUE">Issue</option>
                          </select>
                        ) : (
                          getStatusBadge(item.status)
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 text-center">
                        {item.etaAt ? (
                          <span
                            className={
                              new Date(item.etaAt) < new Date() &&
                              ![
                                "DELIVERED",
                                "CHECKED_IN",
                                "INSTALLED",
                                "NOT_NEEDED",
                              ].includes(item.status)
                                ? "text-red-600 dark:text-red-400 font-medium"
                                : ""
                            }
                          >
                            {new Date(item.etaAt).toLocaleDateString()}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <div className="flex items-center gap-2 justify-center">
                          {canEdit && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedItem(item);
                                  setShowEditItemModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                title="Edit"
                              >
                                <Edit2 className="w-5 h-5" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (
                                    confirm(
                                      "Are you sure you want to delete this item?",
                                    )
                                  ) {
                                    await deleteAccessoryItem(item.id, userId);
                                    refreshTracker();
                                  }
                                }}
                                className="text-red-600 hover:text-red-700 dark:text-red-400"
                                title="Delete"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {tracker.items.map((item: any) => (
                <div
                  key={item.id}
                  className={`p-4 ${
                    needsAttention(item) ? "bg-red-50 dark:bg-red-900/10" : ""
                  }`}
                >
                  {needsAttention(item) && (
                    <div className="flex items-center gap-2 text-red-500 text-sm font-medium mb-2">
                      <AlertCircle className="w-4 h-4" />
                      Needs Attention
                    </div>
                  )}
                  <div className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {item.name}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Category:
                      </span>
                      <span>{item.category.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Quantity:
                      </span>
                      <span>{item.quantity}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400">
                        Status:
                      </span>
                      {canEdit ? (
                        <select
                          value={item.status}
                          onChange={(e) =>
                            handleStatusChange(
                              item.id,
                              e.target.value as AccessoryItemStatus,
                            )
                          }
                          className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      ) : (
                        getStatusBadge(item.status)
                      )}
                    </div>
                    {item.etaAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">
                          ETA:
                        </span>
                        <span
                          className={
                            new Date(item.etaAt) < new Date() &&
                            ![
                              "DELIVERED",
                              "CHECKED_IN",
                              "INSTALLED",
                              "NOT_NEEDED",
                            ].includes(item.status)
                              ? "text-red-600 dark:text-red-400 font-medium"
                              : ""
                          }
                        >
                          {new Date(item.etaAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    {canEdit && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setShowEditItemModal(true);
                          }}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (
                              confirm(
                                "Are you sure you want to delete this item?",
                              )
                            ) {
                              await deleteAccessoryItem(item.id, userId);
                              refreshTracker();
                            }
                          }}
                          className="flex-1 px-3 py-2 text-sm border border-red-300 dark:border-red-600 rounded-md text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setSelectedItem(item);
                        setShowItemHistory(true);
                      }}
                      className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      History
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showAddItemModal && (
        <AddItemModal
          trackerId={tracker.id}
          userId={userId}
          onClose={() => setShowAddItemModal(false)}
          onSuccess={() => {
            setShowAddItemModal(false);
            refreshTracker();
          }}
        />
      )}

      {showEditItemModal && selectedItem && (
        <EditItemModal
          item={selectedItem}
          userId={userId}
          onClose={() => {
            setShowEditItemModal(false);
            setSelectedItem(null);
          }}
          onSuccess={() => {
            setShowEditItemModal(false);
            setSelectedItem(null);
            refreshTracker();
          }}
        />
      )}

      {showEditTrackerModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowEditTrackerModal(false)}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold">Edit Tracker</h2>
                <button
                  onClick={() => setShowEditTrackerModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Invoice #
                    </label>
                    <input
                      type="text"
                      value={trackerForm.invoiceNumber}
                      onChange={(e) =>
                        setTrackerForm((prev) => ({
                          ...prev,
                          invoiceNumber: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Invoice Created
                    </label>
                    <input
                      type="date"
                      value={trackerForm.invoiceCreatedAt}
                      onChange={(e) =>
                        setTrackerForm((prev) => ({
                          ...prev,
                          invoiceCreatedAt: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Remeasure Approved
                    </label>
                    <input
                      type="date"
                      value={trackerForm.remeasureApprovedAt}
                      onChange={(e) =>
                        setTrackerForm((prev) => ({
                          ...prev,
                          remeasureApprovedAt: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Department
                  </label>
                  <select
                    value={trackerForm.department}
                    onChange={(e) =>
                      setTrackerForm((prev) => ({
                        ...prev,
                        department: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select department...</option>
                    <option value="CABINETS">Cabinets</option>
                    <option value="COUNTERTOPS">Countertops</option>
                    <option value="BOTH">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={trackerForm.notes}
                    onChange={(e) =>
                      setTrackerForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowEditTrackerModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTracker}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

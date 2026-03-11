"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";
import {
  getSampleRequestHistory,
  updateSampleRequestStatus,
  cancelSampleRequest,
  type SampleRequestHistoryWithRelations,
  type SampleRequestWithRelations,
  type SampleRequestStatus,
  type SampleRequestProvider,
} from "@/lib/samplesRequests";

interface Props {
  initialRequest: SampleRequestWithRelations;
  userId: string;
  userRole: string;
  provider: SampleRequestProvider | null;
}

const statusOrder: SampleRequestStatus[] = [
  "REQUESTED",
  "IN_PROGRESS",
  "ORDERED",
  "DELIVERED",
  "CANCELED",
];

export default function SamplesRequestDetailClient({
  initialRequest,
  userId,
  userRole,
  provider,
}: Props) {
  const router = useRouter();
  const [request, setRequest] = useState(initialRequest);
  const [history, setHistory] = useState<SampleRequestHistoryWithRelations[]>(
    [],
  );
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [notification, setNotification] = useState<
    { type: "success" | "error"; message: string } | undefined
  >();

  const isAdmin = userRole === "admin";
  const canManageStatus = ["admin", "office"].includes(userRole);
  const canCancel = ["admin", "office", "sales"].includes(userRole);

  const reloadHistory = async (active = true) => {
    try {
      const entries = await getSampleRequestHistory({
        requestId: request.id,
      });
      if (active) setHistory(entries);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      if (active) setLoadingHistory(false);
    }
  };

  useEffect(() => {
    let active = true;
    reloadHistory(active);
    return () => {
      active = false;
    };
  }, [request.id]);

  useEffect(() => {
    if (!isAdmin) return;
    if (request.status !== "REQUESTED") return;

    updateSampleRequestStatus({
      requestId: request.id,
      status: "IN_PROGRESS",
      userId,
      message: "Opened by admin",
    })
      .then((updated) => {
        setRequest(updated);
        reloadHistory(true);
      })
      .catch((error) => {
        console.error("Error auto-updating status:", error);
      });
  }, [isAdmin, request.id, request.status, userId]);

  const changeStatus = async (nextStatus: SampleRequestStatus) => {
    if (!canManageStatus) return;
    try {
      const updated = await updateSampleRequestStatus({
        requestId: request.id,
        status: nextStatus,
        userId,
      });
      setRequest(updated);
      await reloadHistory(true);
      setNotification({
        type: "success",
        message: `Status updated to ${nextStatus.replace(/_/g, " ")}.`,
      });
    } catch (error: any) {
      console.error("Error updating status:", error);
      setNotification({
        type: "error",
        message: error?.message || "Failed to update status.",
      });
    }
  };

  const handleCancel = async () => {
    if (!canCancel) return;
    try {
      const updated = await cancelSampleRequest({
        requestId: request.id,
        userId,
      });
      setRequest(updated);
      await reloadHistory(true);
      setNotification({ type: "success", message: "Request canceled." });
    } catch (error: any) {
      console.error("Error canceling request:", error);
      setNotification({
        type: "error",
        message: error?.message || "Failed to cancel request.",
      });
    }
  };

  const clientName =
    request.job?.customer.displayName || request.customer?.displayName || "—";
  const jobLabel = request.job
    ? `Job #${request.job.jobNumber} — ${request.job.jobName}`
    : request.jobName || "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => router.push("/samples-request")}
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to list
          </button>
          <h1 className="text-3xl font-bold">Sample Request</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {clientName} · {jobLabel}
          </p>
        </div>
        {request.status !== "CANCELED" && (canManageStatus || canCancel) && (
          <div className="flex flex-wrap gap-2">
            {canManageStatus &&
              statusOrder
                .filter((status) =>
                  ["REQUESTED", "IN_PROGRESS", "ORDERED", "DELIVERED"].includes(
                    status,
                  ),
                )
                .map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => changeStatus(status)}
                    disabled={request.status === status}
                    className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
                      request.status === status
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    {status.replace(/_/g, " ")}
                  </button>
                ))}
            {canCancel && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium rounded-md border border-red-300 text-red-600 hover:bg-red-50"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {notification && (
        <div
          className={`rounded-md border p-3 text-sm flex items-center justify-between ${
            notification.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <span>{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(undefined)}
            className="text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="text-sm text-gray-500">Status</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {request.status.replace(/_/g, " ")}
          </div>
          <div className="text-sm text-gray-500">Sample Type</div>
          <div className="text-gray-800 dark:text-gray-200">
            {request.sampleType}
          </div>
          <div className="text-sm text-gray-500">Brand</div>
          <div className="text-gray-800 dark:text-gray-200">
            {request.brand}
          </div>
        </div>
        <div className="space-y-3">
          <div className="text-sm text-gray-500">Color Name</div>
          <div className="text-gray-800 dark:text-gray-200">
            {request.colorName}
          </div>
          <div className="text-sm text-gray-500">Quantity</div>
          <div className="text-gray-800 dark:text-gray-200">
            {request.quantity}
          </div>
          <div className="text-sm text-gray-500">Requested By</div>
          <div className="text-gray-800 dark:text-gray-200">
            {request.requestedByUser?.name || "—"}
          </div>
        </div>
        {request.notes && (
          <div className="lg:col-span-2">
            <div className="text-sm text-gray-500">Notes</div>
            <div className="text-gray-800 dark:text-gray-200">
              {request.notes}
            </div>
          </div>
        )}
      </div>

      {isAdmin && provider && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Provider Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <div className="text-xs uppercase text-gray-500">Provider</div>
              <div className="font-medium">{provider.name}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Sample Type</div>
              <div className="font-medium">{provider.sampleType}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">
                Contact Name
              </div>
              <div className="font-medium">{provider.contactName || "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">
                Contact Method
              </div>
              <div className="font-medium">{provider.contactMethod || "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Phone</div>
              <div className="font-medium">{provider.contactPhone || "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Email</div>
              <div className="font-medium">{provider.contactEmail || "—"}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs uppercase text-gray-500">
                How we get it
              </div>
              <div className="font-medium">{provider.notes || "—"}</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">History</h2>
        </div>
        {loadingHistory ? (
          <div className="text-sm text-gray-500">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="text-sm text-gray-500">No history yet.</div>
        ) : (
          <div className="space-y-3">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="rounded-md border border-gray-200 dark:border-gray-700 p-3"
              >
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {entry.fromStatus
                    ? `${entry.fromStatus.replace(/_/g, " ")} → ${entry.toStatus?.replace(
                        /_/g,
                        " ",
                      )}`
                    : entry.toStatus?.replace(/_/g, " ") || "—"}
                </div>
                {entry.message && (
                  <div className="text-xs text-gray-500 mt-1">
                    {entry.message}
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(entry.createdAt).toLocaleString()} ·{" "}
                  {entry.changedByUser?.name || "System"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { QuoteRepairStatus } from "@prisma/client";
import { Plus, Trash2, Eye, Printer, Camera } from "lucide-react";
import {
  QUOTE_REPAIR_STATUS_LABELS,
  formatQuoteRepairAreas,
  formatUsPhone,
  formatUsd,
  normalizeQuoteRepairDisplayStatus,
} from "@/lib/quoteRepairs";

function statusBadgeClass(status: QuoteRepairStatus) {
  if (normalizeQuoteRepairDisplayStatus(status) === "APPROVED") {
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  }
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
}

export default function QuoteRepairDetailClient({
  repair,
  userId,
  userRole,
  companyCamUrl,
}: {
  repair: any;
  userId: string;
  userRole: string;
  companyCamUrl: string | null;
}) {
  const router = useRouter();
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(
    null,
  );

  const canEditRepair =
    userRole === "admin" ||
    (userRole === "sales" &&
      (repair.salesRepId === userId || repair.createdById === userId));

  const createNewVersion = async () => {
    setCreatingVersion(true);
    try {
      const response = await fetch(`/api/quote-repairs/${repair.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceVersionId: repair.currentVersion?.id || null,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to create version");
      router.push(`/quote-repairs/${repair.id}/versions/${data.id}?mode=edit`);
    } catch (error: any) {
      window.alert(error?.message || "Failed to create version");
    } finally {
      setCreatingVersion(false);
    }
  };

  const deleteVersion = async (versionId: string, versionNumber: number) => {
    if (repair.versions.length <= 1) {
      window.alert("At least one version is required.");
      return;
    }

    const confirmed = window.confirm(`Delete version ${versionNumber}?`);
    if (!confirmed) return;

    setDeletingVersionId(versionId);
    try {
      const response = await fetch(
        `/api/quote-repairs/${repair.id}/versions/${versionId}`,
        {
          method: "DELETE",
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Failed to delete version");
      router.refresh();
    } catch (error: any) {
      window.alert(error?.message || "Failed to delete version");
    } finally {
      setDeletingVersionId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/quote-repairs"
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            ← Back to Quote Repairs
          </Link>
          <h1 className="text-3xl font-bold mt-2">
            {repair.quoteRepairNumber}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {repair.customerName} • {formatQuoteRepairAreas(repair.areas)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {companyCamUrl ? (
            <a
              href={companyCamUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open customer project in CompanyCam"
              aria-label="Open customer project in CompanyCam"
              className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            >
              <Camera className="w-5 h-5" />
            </a>
          ) : (
            <span
              title="No CompanyCam project linked to this customer"
              aria-label="No CompanyCam project linked to this customer"
              className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
            >
              <Camera className="w-5 h-5" />
            </span>
          )}
          {canEditRepair && (
            <button
              disabled={creatingVersion}
              onClick={createNewVersion}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {creatingVersion ? "Creating..." : "Create New Quote"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-2">
          <h2 className="font-semibold text-lg">Job Information</h2>
          <p>
            <span className="font-semibold">Client Name:</span>{" "}
            {repair.customerName}
          </p>
          <p>
            <span className="font-semibold">Address:</span>{" "}
            {repair.propertyAddress}
          </p>
          <p>
            <span className="font-semibold">Phone:</span>{" "}
            {formatUsPhone(repair.customerPhone) || "-"}
          </p>
          <p>
            <span className="font-semibold">Contractor:</span>{" "}
            {repair.contractor || "-"}
          </p>
          <p>
            <span className="font-semibold">Areas:</span>{" "}
            {formatQuoteRepairAreas(repair.areas)}
          </p>
          <p>
            <span className="font-semibold">Sales Rep:</span>{" "}
            {repair.salesRep?.name || repair.salesRep?.email || "-"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-2">
          <h2 className="font-semibold text-lg">Quote Information</h2>
          <p>
            <span className="font-semibold">QR Estimate #:</span>{" "}
            {repair.quoteRepairNumber}
          </p>
          <p>
            <span className="font-semibold">Version #:</span>{" "}
            {repair.currentVersion?.versionNumber || "-"}
          </p>
          <p>
            <span className="font-semibold">Created:</span>{" "}
            {new Date(repair.createdAt).toLocaleString()}
          </p>
          <p>
            <span className="font-semibold">Updated:</span>{" "}
            {new Date(repair.updatedAt).toLocaleString()}
          </p>
          <p>
            <span className="font-semibold">Approved Version:</span>{" "}
            {repair.approvedVersion?.versionNumber || "-"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 font-semibold">
          Version History
        </div>
        <div className="p-4 space-y-3 md:hidden">
          {repair.versions.map((version: any) => (
            <article
              key={version.id}
              className={`rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2 ${
                version.id === repair.currentVersion?.id
                  ? "bg-blue-50/70 dark:bg-blue-950/20"
                  : "bg-white dark:bg-gray-900"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm">
                  Version {version.versionNumber}
                </p>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(version.status as QuoteRepairStatus)}`}
                >
                  {
                    QUOTE_REPAIR_STATUS_LABELS[
                      normalizeQuoteRepairDisplayStatus(
                        version.status as QuoteRepairStatus,
                      )
                    ]
                  }
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                <p>
                  <span className="font-semibold">Created By:</span>{" "}
                  {version.createdBy?.name || version.createdBy?.email || "-"}
                </p>
                <p>
                  <span className="font-semibold">Updated By:</span>{" "}
                  {version.updatedBy?.name || version.updatedBy?.email || "-"}
                </p>
                <p>
                  <span className="font-semibold">Created:</span>{" "}
                  {new Date(version.createdAt).toLocaleString()}
                </p>
                <p>
                  <span className="font-semibold">Total:</span>{" "}
                  {formatUsd(version.total)}
                </p>
                <p className="col-span-2">
                  <span className="font-semibold">Approved By:</span>{" "}
                  {version.approvedBy?.name || version.approvedBy?.email || "-"}
                  {version.approvedAt
                    ? ` • ${new Date(version.approvedAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/quote-repairs/${repair.id}/versions/${version.id}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Details
                </Link>
                <Link
                  href={`/quote-repairs/print/${version.id}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </Link>
                {userRole === "admin" && (
                  <button
                    type="button"
                    disabled={deletingVersionId === version.id}
                    onClick={() =>
                      deleteVersion(version.id, version.versionNumber)
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deletingVersionId === version.id ? "Deleting" : "Delete"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                {[
                  "Version",
                  "Status",
                  "Created By",
                  "Created",
                  "Updated By",
                  "Approved By",
                  "Total",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {repair.versions.map((version: any) => (
                <tr
                  key={version.id}
                  className={
                    version.id === repair.currentVersion?.id
                      ? "bg-blue-50/70 dark:bg-blue-950/20"
                      : ""
                  }
                >
                  <td className="px-4 py-3 font-medium">
                    {version.versionNumber}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(version.status as QuoteRepairStatus)}`}
                    >
                      {
                        QUOTE_REPAIR_STATUS_LABELS[
                          normalizeQuoteRepairDisplayStatus(
                            version.status as QuoteRepairStatus,
                          )
                        ]
                      }
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {version.createdBy?.name || version.createdBy?.email || "-"}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(version.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {version.updatedBy?.name || version.updatedBy?.email || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      {version.approvedBy?.name ||
                        version.approvedBy?.email ||
                        "-"}
                    </div>
                    {version.approvedAt && (
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(version.approvedAt).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{formatUsd(version.total)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/quote-repairs/${repair.id}/versions/${version.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Details
                      </Link>
                      <Link
                        href={`/quote-repairs/print/${version.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print
                      </Link>
                      {userRole === "admin" && (
                        <button
                          type="button"
                          disabled={deletingVersionId === version.id}
                          onClick={() =>
                            deleteVersion(version.id, version.versionNumber)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {deletingVersionId === version.id
                            ? "Deleting"
                            : "Delete"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="font-semibold mb-3">Activity</h2>
        <div className="space-y-2 text-sm">
          {repair.activities.map((entry: any) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-4 border-b border-gray-100 dark:border-gray-700 pb-2"
            >
              <div>
                <div className="font-medium">{entry.action}</div>
                {entry.afterSummary && (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {entry.afterSummary}
                  </div>
                )}
                <div className="text-gray-500">
                  {entry.actor?.name || entry.actor?.email || "-"}
                </div>
              </div>
              <div className="text-gray-500 whitespace-nowrap">
                {new Date(entry.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

export default function CustomersSyncClient() {
  const [syncing, setSyncing] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    stage: string;
    message: string;
    processed?: number;
    total?: number;
    created?: number;
    updated?: number;
    errors?: number;
    jobId?: string;
  } | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    stats?: {
      total: number;
      created: number;
      updated: number;
      errors: number;
    };
  } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    setSyncProgress(null);
    setCurrentJobId(null);

    try {
      const response = await fetch("/api/pipedrive/sync", { method: "POST" });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sync failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));
          setSyncProgress(data);
          if (data.jobId && !currentJobId) setCurrentJobId(data.jobId);

          if (data.stage === "complete") {
            setResult({
              success: true,
              message: "Sync completed successfully",
              stats: {
                total: data.total || 0,
                created: data.created || 0,
                updated: data.updated || 0,
                errors: data.errors || 0,
              },
            });
            setSyncing(false);
          } else if (data.stage === "error") {
            setResult({
              success: false,
              message: data.message || "Sync failed",
            });
            setSyncing(false);
          } else if (data.stage === "cancelled") {
            setResult({
              success: false,
              message: "Sync was cancelled",
              stats: {
                total: data.total || 0,
                created: data.created || 0,
                updated: data.updated || 0,
                errors: data.errors || 0,
              },
            });
            setSyncing(false);
          }
        }
      }
    } catch (error: any) {
      setResult({ success: false, message: error.message || "Failed to sync" });
      setSyncing(false);
    }
  };

  const handleCancelSync = async () => {
    if (!currentJobId) return;
    try {
      await fetch(`/api/pipedrive/sync?action=cancel&jobId=${currentJobId}`);
    } catch {
      // best-effort
    }
  };

  const progressPct =
    syncProgress?.total && syncProgress?.processed
      ? Math.round((syncProgress.processed / syncProgress.total) * 100)
      : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/customers-v2"
          className="inline-flex items-center text-teal-600 hover:text-teal-800 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Pipedrive Sync
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Sync persons, organizations, and deals from Pipedrive into the
          Customer directory.
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-teal-600 dark:text-teal-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-teal-900 dark:text-teal-200">
              Required environment variables
            </h3>
            <ul className="text-sm text-teal-800 dark:text-teal-300 mt-1 list-disc list-inside space-y-0.5">
              <li>
                <code className="bg-teal-100 dark:bg-teal-800 px-1 rounded">
                  PIPEDRIVE_API_TOKEN
                </code>
              </li>
              <li>
                <code className="bg-teal-100 dark:bg-teal-800 px-1 rounded">
                  PIPEDRIVE_COMPANY_DOMAIN
                </code>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Sync Control
        </h2>
        <button
          onClick={handleSync}
          disabled={syncing}
          className={`w-full flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-colors ${
            syncing
              ? "bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
              : "bg-teal-600 text-white hover:bg-teal-700"
          }`}
        >
          <RefreshCw
            className={`h-5 w-5 mr-2 ${syncing ? "animate-spin" : ""}`}
          />
          {syncing ? "Syncing…" : "Start Sync from Pipedrive"}
        </button>
        {syncing && currentJobId && (
          <button
            onClick={handleCancelSync}
            className="w-full px-6 py-2 border border-red-300 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 font-medium transition-colors"
          >
            Cancel Sync
          </button>
        )}
      </div>

      {/* Progress */}
      {syncProgress && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Progress
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {syncProgress.message}
              </span>
              {syncProgress.total && syncProgress.processed !== undefined && (
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {syncProgress.processed} / {syncProgress.total} ({progressPct}
                  %)
                </span>
              )}
            </div>
            {syncProgress.total && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-teal-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
            {syncProgress.stage === "processing" && (
              <div className="grid grid-cols-3 gap-4 pt-2 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Created:
                  </span>
                  <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                    {syncProgress.created || 0}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Updated:
                  </span>
                  <span className="ml-2 font-semibold text-teal-600 dark:text-teal-400">
                    {syncProgress.updated || 0}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Errors:
                  </span>
                  <span className="ml-2 font-semibold text-red-600 dark:text-red-400">
                    {syncProgress.errors || 0}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={`border rounded-lg p-6 mb-6 ${
            result.success
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700"
          }`}
        >
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 mt-0.5" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 mt-0.5" />
            )}
            <div className="flex-1">
              <h3
                className={`font-semibold ${
                  result.success
                    ? "text-green-900 dark:text-green-200"
                    : "text-red-900 dark:text-red-200"
                }`}
              >
                {result.success ? "Sync Complete" : "Sync Failed"}
              </h3>
              <p
                className={`mt-1 text-sm ${
                  result.success
                    ? "text-green-800 dark:text-green-300"
                    : "text-red-800 dark:text-red-300"
                }`}
              >
                {result.message}
              </p>
              {result.stats && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(
                    [
                      {
                        label: "Total Deals",
                        value: result.stats.total,
                        color: "text-gray-900 dark:text-gray-100",
                      },
                      {
                        label: "Created",
                        value: result.stats.created,
                        color: "text-green-600 dark:text-green-400",
                      },
                      {
                        label: "Updated",
                        value: result.stats.updated,
                        color: "text-teal-600 dark:text-teal-400",
                      },
                      {
                        label: "Errors",
                        value: result.stats.errors,
                        color: "text-red-600 dark:text-red-400",
                      },
                    ] as const
                  ).map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="bg-white dark:bg-gray-800 bg-opacity-50 rounded p-3"
                    >
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {label}
                      </div>
                      <div className={`text-2xl font-bold ${color}`}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
          What this sync does
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>Fetches all persons (→ CLIENT records)</li>
          <li>Fetches all organizations (→ CONTRACTOR/DESIGNER records)</li>
          <li>Fetches all deals and creates/updates Job records</li>
          <li>
            Links clients to their referring contractor via{" "}
            <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
              referredByOrgName
            </code>
          </li>
          <li>
            Captures Pipedrive v2 custom fields: job type, property address,
            QuickBooks URL, CompanyCam ID/URL
          </li>
        </ol>
      </div>
    </div>
  );
}

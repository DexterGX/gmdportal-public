"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

export default function PipedriveSyncClient() {
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
      const response = await fetch("/api/pipedrive/sync", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sync failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            setSyncProgress(data);

            if (data.jobId && !currentJobId) {
              setCurrentJobId(data.jobId);
            }

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
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      setResult({
        success: false,
        message: error.message || "Failed to sync",
      });
      setSyncing(false);
    }
  };

  const handleCancelSync = async () => {
    if (!currentJobId) return;

    try {
      const response = await fetch(
        `/api/pipedrive/sync?action=cancel&jobId=${currentJobId}`
      );
      if (!response.ok) {
        throw new Error("Failed to cancel sync");
      }
    } catch (error) {
      console.error("Failed to cancel:", error);
    }
  };

  const getProgressPercentage = () => {
    if (!syncProgress?.total || !syncProgress?.processed) return 0;
    return Math.round((syncProgress.processed / syncProgress.total) * 100);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/customers"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          Pipedrive Sync
        </h1>
        <p className="text-gray-600 mt-2">
          Sync deals from Pipedrive to create prospect records in the database
        </p>
      </div>

      {/* Configuration Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
          <div>
            <h3 className="font-semibold text-blue-900">Configuration Required</h3>
            <p className="text-sm text-blue-800 mt-1">
              Make sure you have set the following environment variables in <code className="bg-blue-100 px-1 rounded">.env.local</code>:
            </p>
            <ul className="text-sm text-blue-800 mt-2 list-disc list-inside">
              <li><code className="bg-blue-100 px-1 rounded">PIPEDRIVE_API_TOKEN</code> - Get from Settings → Personal Preferences → API</li>
              <li><code className="bg-blue-100 px-1 rounded">PIPEDRIVE_COMPANY_DOMAIN</code> - Your subdomain (e.g., "yourcompany" for yourcompany.pipedrive.com)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sync Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Sync Control
        </h2>

        <div className="space-y-4">
          <button
            onClick={handleSync}
            disabled={syncing}
            className={`w-full flex items-center justify-center px-6 py-3 rounded-lg font-medium ${
              syncing
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            <RefreshCw className={`h-5 w-5 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Start Sync from Pipedrive"}
          </button>

          {syncing && currentJobId && (
            <button
              onClick={handleCancelSync}
              className="w-full px-6 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 font-medium"
            >
              Cancel Sync
            </button>
          )}
        </div>
      </div>

      {/* Progress Display */}
      {syncProgress && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Progress
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{syncProgress.message}</span>
              {syncProgress.total && syncProgress.processed !== undefined && (
                <span className="font-medium text-gray-900">
                  {syncProgress.processed} / {syncProgress.total} ({getProgressPercentage()}%)
                </span>
              )}
            </div>

            {syncProgress.total && (
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
            )}

            {syncProgress.stage === "processing" && (
              <div className="grid grid-cols-3 gap-4 pt-2 text-sm">
                <div>
                  <span className="text-gray-600">Created:</span>
                  <span className="ml-2 font-semibold text-green-600">
                    {syncProgress.created || 0}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Updated:</span>
                  <span className="ml-2 font-semibold text-blue-600">
                    {syncProgress.updated || 0}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Errors:</span>
                  <span className="ml-2 font-semibold text-red-600">
                    {syncProgress.errors || 0}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div
          className={`border rounded-lg p-6 ${
            result.success
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div className="flex items-start">
            {result.success ? (
              <CheckCircle className="h-6 w-6 text-green-600 mt-0.5 mr-3" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-600 mt-0.5 mr-3" />
            )}
            <div className="flex-1">
              <h3
                className={`font-semibold ${
                  result.success ? "text-green-900" : "text-red-900"
                }`}
              >
                {result.success ? "Sync Complete" : "Sync Failed"}
              </h3>
              <p
                className={`mt-1 ${
                  result.success ? "text-green-800" : "text-red-800"
                }`}
              >
                {result.message}
              </p>

              {result.stats && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="bg-white bg-opacity-50 rounded p-3">
                    <div className="text-sm text-gray-600">Total Deals</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {result.stats.total}
                    </div>
                  </div>
                  <div className="bg-white bg-opacity-50 rounded p-3">
                    <div className="text-sm text-gray-600">Created</div>
                    <div className="text-2xl font-bold text-green-600">
                      {result.stats.created}
                    </div>
                  </div>
                  <div className="bg-white bg-opacity-50 rounded p-3">
                    <div className="text-sm text-gray-600">Updated</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {result.stats.updated}
                    </div>
                  </div>
                  <div className="bg-white bg-opacity-50 rounded p-3">
                    <div className="text-sm text-gray-600">Errors</div>
                    <div className="text-2xl font-bold text-red-600">
                      {result.stats.errors}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3">How It Works</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>Connects to your Pipedrive account using your API token</li>
          <li>Fetches all deals (open, won, and lost)</li>
          <li>Creates new Customer records with type PROSPECT for deals that don't exist</li>
          <li>Updates existing prospect records with latest Pipedrive data</li>
          <li>Stores full deal information in the pipedriveData JSON field</li>
          <li>Links contact and organization information to the customer record</li>
        </ol>

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> This sync creates PROSPECTS only. When deals move to certain stages or are won,
            they can be promoted to CLIENT status manually or through automation.
          </p>
        </div>
      </div>
    </div>
  );
}

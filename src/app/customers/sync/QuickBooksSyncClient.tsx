"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info,
  Key,
} from "lucide-react";

interface TokenStatus {
  configured: boolean;
  realmId?: string;
  expiresAt?: string;
  isExpired?: boolean;
  timeUntilExpiry?: string;
  lastUpdated?: string;
  message?: string;
}

export default function QuickBooksSyncClient() {
  const [syncing, setSyncing] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    stage: string;
    message: string;
    processed?: number;
    total?: number;
    jobId?: string;
  } | null>(null);
  const [tokenForm, setTokenForm] = useState({
    accessToken: "",
    refreshToken: "",
    realmId: "",
    expiresIn: "3600",
  });
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    stats?: {
      total: number;
      created: number;
      updated: number;
      jobsCreated?: number;
      jobsUpdated?: number;
      errors: number;
    };
  } | null>(null);

  useEffect(() => {
    loadTokenStatus();
  }, []);

  const loadTokenStatus = async () => {
    try {
      const response = await fetch("/api/quickbooks/tokens");
      const data = await response.json();
      setTokenStatus(data);
    } catch (error) {
      console.error("Failed to load token status:", error);
    }
  };

  const handleSaveTokens = async () => {
    try {
      const response = await fetch("/api/quickbooks/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: tokenForm.accessToken,
          refreshToken: tokenForm.refreshToken,
          realmId: tokenForm.realmId,
          expiresIn: parseInt(tokenForm.expiresIn),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message:
            "Tokens saved successfully! They will auto-refresh when needed.",
        });
        setShowTokenForm(false);
        setTokenForm({
          accessToken: "",
          refreshToken: "",
          realmId: "",
          expiresIn: "3600",
        });
        loadTokenStatus();
      } else {
        setResult({
          success: false,
          message: data.error || "Failed to save tokens",
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: "Error saving tokens",
      });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    setSyncProgress(null);
    setCurrentJobId(null);

    try {
      const eventSource = new EventSource("/api/customers/sync", {
        // @ts-ignore - EventSource accepts a method in some browsers
      });

      // Use fetch with streaming for POST
      const response = await fetch("/api/customers/sync", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to start sync");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              setSyncProgress(data);

              // Store job ID when we receive it
              if (data.jobId && !currentJobId) {
                setCurrentJobId(data.jobId);
              }

              if (data.stage === "complete") {
                setResult({
                  success: true,
                  message: data.message,
                  stats: data.stats,
                });
                setSyncing(false);
                setCurrentJobId(null);
              } else if (data.stage === "error") {
                setResult({
                  success: false,
                  message: data.message,
                });
                setSyncing(false);
                setCurrentJobId(null);
              } else if (data.stage === "cancelled") {
                setResult({
                  success: false,
                  message: data.message,
                  stats: data.stats,
                });
                setSyncing(false);
                setCurrentJobId(null);
              }
            } catch (e) {
              console.error("Failed to parse progress update:", e);
            }
          }
        }
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred",
      });
      setSyncing(false);
      setCurrentJobId(null);
    }
  };

  const handleCancelSync = async () => {
    if (!currentJobId) return;

    try {
      const response = await fetch("/api/customers/sync/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: currentJobId }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Failed to cancel sync:", data.error);
      }
    } catch (error) {
      console.error("Error cancelling sync:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/customers"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Customers
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          QuickBooks Sync
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Synchronize customer data from QuickBooks Online
        </p>
      </div>

      {/* Configuration Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium mb-2">QuickBooks Integration Setup</p>
            <p className="text-blue-800 dark:text-blue-200">
              Tokens are stored securely in the database and automatically
              refreshed when needed. You only need to configure this once -
              tokens will stay valid indefinitely through auto-refresh.
            </p>
          </div>
        </div>
      </div>

      {/* Token Status */}
      {tokenStatus && (
        <div
          className={`rounded-xl border p-4 ${
            tokenStatus.configured && !tokenStatus.isExpired
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
              : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
          }`}
        >
          <div className="flex items-start gap-3">
            {tokenStatus.configured && !tokenStatus.isExpired ? (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium text-sm mb-1">
                {tokenStatus.configured
                  ? "QuickBooks Connected"
                  : "QuickBooks Not Configured"}
              </p>
              {tokenStatus.configured ? (
                <div className="text-sm space-y-1">
                  <p>
                    <span className="font-medium">Realm ID:</span>{" "}
                    {tokenStatus.realmId}
                  </p>
                  <p>
                    <span className="font-medium">Status:</span>{" "}
                    {tokenStatus.isExpired
                      ? "Expired (will auto-refresh)"
                      : `Valid for ${tokenStatus.timeUntilExpiry}`}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Last updated:{" "}
                    {new Date(tokenStatus.lastUpdated!).toLocaleString()}
                  </p>
                </div>
              ) : (
                <p className="text-sm">{tokenStatus.message}</p>
              )}
              <button
                onClick={() => setShowTokenForm(!showTokenForm)}
                className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Key className="w-4 h-4" />
                {tokenStatus.configured ? "Update Tokens" : "Configure Tokens"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Token Configuration Form */}
      {showTokenForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            QuickBooks Token Configuration
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Access Token
              </label>
              <input
                type="text"
                value={tokenForm.accessToken}
                onChange={(e) =>
                  setTokenForm({ ...tokenForm, accessToken: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="From QuickBooks OAuth Playground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Refresh Token
              </label>
              <input
                type="text"
                value={tokenForm.refreshToken}
                onChange={(e) =>
                  setTokenForm({ ...tokenForm, refreshToken: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="From QuickBooks OAuth Playground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Realm ID (Company ID)
              </label>
              <input
                type="text"
                value={tokenForm.realmId}
                onChange={(e) =>
                  setTokenForm({ ...tokenForm, realmId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="e.g., 4620816365123456789"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveTokens}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Tokens
              </button>
              <button
                onClick={() => setShowTokenForm(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* READ-ONLY Safety Notice */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
        <div className="flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-900 dark:text-green-100">
            <p className="font-semibold mb-2">✓ Safe: Read-Only Integration</p>
            <p className="text-green-800 dark:text-green-200">
              This sync is <strong>completely safe</strong>. It only{" "}
              <strong>reads</strong> customer data from QuickBooks and saves it
              to your local database. It will{" "}
              <strong>never create, modify, or delete</strong> any records in
              QuickBooks. Your QuickBooks data remains completely unchanged.
            </p>
          </div>
        </div>
      </div>

      {/* Sync Action Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Sync Customer Data
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          This will fetch all customers from QuickBooks and update your local
          database. Existing customers will be updated, and new customers will
          be created.
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Start Sync"}
          </button>

          {syncing && currentJobId && (
            <button
              onClick={handleCancelSync}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Cancel Sync
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {syncing && syncProgress && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {syncProgress.message}
              </span>
              {syncProgress.total && syncProgress.processed !== undefined && (
                <span className="text-gray-600 dark:text-gray-400">
                  {syncProgress.processed} / {syncProgress.total}
                </span>
              )}
            </div>

            {syncProgress.total && syncProgress.processed !== undefined ? (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300 ease-out flex items-center justify-end pr-2"
                  style={{
                    width: `${Math.min(
                      100,
                      (syncProgress.processed / syncProgress.total) * 100
                    )}%`,
                  }}
                >
                  <span className="text-xs text-white font-medium">
                    {Math.round(
                      (syncProgress.processed / syncProgress.total) * 100
                    )}
                    %
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-600 h-full animate-pulse"
                  style={{ width: "30%" }}
                />
              </div>
            )}

            <div className="text-xs text-gray-500 dark:text-gray-500">
              Stage: {syncProgress.stage}
            </div>
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div
          className={`rounded-xl border p-6 ${
            result.success
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
          }`}
        >
          <div className="flex gap-3">
            {result.success ? (
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3
                className={`font-semibold mb-2 ${
                  result.success
                    ? "text-green-900 dark:text-green-100"
                    : "text-red-900 dark:text-red-100"
                }`}
              >
                {result.message}
              </h3>
              {result.stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {result.stats.total}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Total Records
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {result.stats.created}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Customers Created
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {result.stats.updated}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Customers Updated
                    </div>
                  </div>
                  {(result.stats.jobsCreated !== undefined || result.stats.jobsUpdated !== undefined) && (
                    <>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {result.stats.jobsCreated || 0}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Jobs Created
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {result.stats.jobsUpdated || 0}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Jobs Updated
                        </div>
                      </div>
                    </>
                  )}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {result.stats.errors}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Errors
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          How It Works
        </h2>
        <ol className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-semibold">
              1
            </span>
            <span>Fetches all customer records from QuickBooks Online API</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-semibold">
              2
            </span>
            <span>
              Matches customers by QuickBooks ID to find existing records
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-semibold">
              3
            </span>
            <span>
              Updates existing customers or creates new ones as needed
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-semibold">
              4
            </span>
            <span>Preserves existing relationships (closet jobs, etc.)</span>
          </li>
        </ol>
      </div>
    </div>
  );
}

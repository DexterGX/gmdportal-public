"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit,
  KeyRound,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  ShieldOff,
  Trash2,
  X,
} from "lucide-react";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";
import { API_SCOPES, type ApiScope } from "@/lib/apiScopes";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  usageCount: number;
  notes: string | null;
  createdAt: string;
  revokedAt: string | null;
  createdBy: { id: string; name: string | null } | null;
  revokedBy: { id: string; name: string | null } | null;
};

type FormState = {
  id?: string;
  name: string;
  notes: string;
  scopes: ApiScope[];
  expiresAt: string; // yyyy-mm-dd or ""
};

const emptyForm: FormState = {
  name: "",
  notes: "",
  scopes: [],
  expiresAt: "",
};

type KeyStatus = "Active" | "Revoked" | "Expired";
const STATUS_OPTIONS: KeyStatus[] = ["Active", "Revoked", "Expired"];

const SCOPE_LABELS: Record<string, string> = Object.fromEntries(
  API_SCOPES.map((scope) => [scope.id, scope.label]),
);

function keyStatus(key: ApiKeyRow): KeyStatus {
  if (!key.isActive) return "Revoked";
  if (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()) return "Expired";
  return "Active";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const statusBadgeClass: Record<KeyStatus, string> = {
  Active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Revoked: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  Expired: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export default function ApiKeysClient() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [scopeFilter, setScopeFilter] = useState<string[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newSecret, setNewSecret] = useState<{ name: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/api-keys", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load API keys");
      setKeys(data.keys || []);
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to load API keys" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const scopeFilterOptions = useMemo(() => API_SCOPES.map((scope) => scope.label), []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return keys.filter((key) => {
      if (term) {
        const haystack = [key.name, key.keyPrefix, key.notes || "", key.createdBy?.name || ""]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (statusFilter.length && !statusFilter.includes(keyStatus(key))) return false;
      if (scopeFilter.length) {
        const labels = key.scopes.map((scope) => SCOPE_LABELS[scope] || scope);
        if (!scopeFilter.some((label) => labels.includes(label))) return false;
      }
      return true;
    });
  }, [keys, search, statusFilter, scopeFilter]);

  const hasActiveFilters =
    search.trim().length > 0 || statusFilter.length > 0 || scopeFilter.length > 0;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter([]);
    setScopeFilter([]);
  };

  const openCreate = () => {
    setForm({ ...emptyForm, scopes: [] });
    setMessage(null);
    setIsModalOpen(true);
  };

  const openEdit = (key: ApiKeyRow) => {
    setForm({
      id: key.id,
      name: key.name,
      notes: key.notes || "",
      scopes: key.scopes as ApiScope[],
      expiresAt: key.expiresAt ? key.expiresAt.slice(0, 10) : "",
    });
    setMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setForm(emptyForm);
  };

  const toggleScope = (scope: ApiScope) => {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setMessage({ type: "error", text: "Name is required." });
      return;
    }
    if (!form.scopes.some((scope) => scope !== "pricing:read")) {
      setMessage({ type: "error", text: "Pick at least one program the key can read." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        name: form.name.trim(),
        notes: form.notes.trim(),
        scopes: form.scopes,
        // End of the chosen day, local time.
        expiresAt: form.expiresAt
          ? new Date(`${form.expiresAt}T23:59:59`).toISOString()
          : null,
      };
      const res = await fetch(
        form.id ? `/api/settings/api-keys/${form.id}` : "/api/settings/api-keys",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save API key");

      if (form.id) {
        setKeys((prev) => prev.map((k) => (k.id === data.key.id ? data.key : k)));
        setMessage({ type: "success", text: `Updated "${data.key.name}".` });
      } else {
        setKeys((prev) => [data.key, ...prev]);
        setNewSecret({ name: data.key.name, secret: data.secret });
        setCopied(false);
        setMessage({ type: "success", text: `Created key "${data.key.name}".` });
      }
      setIsModalOpen(false);
      setForm(emptyForm);
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to save API key" });
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (key: ApiKeyRow, action: "revoke" | "reactivate") => {
    if (
      action === "revoke" &&
      !window.confirm(
        `Revoke "${key.name}"? Any program using this key will stop getting data immediately.`,
      )
    ) {
      return;
    }
    setBusyId(key.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/settings/api-keys/${key.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update API key");
      setKeys((prev) => prev.map((k) => (k.id === data.key.id ? data.key : k)));
      setMessage({
        type: "success",
        text: action === "revoke" ? `Revoked "${key.name}".` : `Reactivated "${key.name}".`,
      });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to update API key" });
    } finally {
      setBusyId(null);
    }
  };

  const deleteKey = async (key: ApiKeyRow) => {
    if (
      !window.confirm(
        `Permanently delete "${key.name}"? This removes the key and its usage history and cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyId(key.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/settings/api-keys/${key.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete API key");
      setKeys((prev) => prev.filter((k) => k.id !== key.id));
      setMessage({ type: "success", text: `Permanently deleted "${key.name}".` });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to delete API key" });
    } finally {
      setBusyId(null);
    }
  };

  const copySecret = async () => {
    if (!newSecret) return;
    try {
      await navigator.clipboard.writeText(newSecret.secret);
      setCopied(true);
    } catch {
      setMessage({ type: "error", text: "Couldn't copy — select the key and copy it manually." });
    }
  };

  const renderScopes = (scopes: string[]) => (
    <div className="flex flex-wrap gap-1">
      {scopes.map((scope) => (
        <span
          key={scope}
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            scope === "pricing:read"
              ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          }`}
        >
          {SCOPE_LABELS[scope] || scope}
        </span>
      ))}
    </div>
  );

  const renderActions = (key: ApiKeyRow) => {
    const busy = busyId === key.id;
    return (
      <div className="flex flex-wrap items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => openEdit(key)}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          title="Edit name, access and expiration"
        >
          <Edit className="h-3.5 w-3.5" /> Edit
        </button>
        {key.isActive ? (
          <button
            type="button"
            onClick={() => setActive(key, "revoke")}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/30"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldOff className="h-3.5 w-3.5" />
            )}
            Revoke
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setActive(key, "reactivate")}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-900/30"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reactivate
            </button>
            <button
              type="button"
              onClick={() => deleteKey(key)}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete permanently
            </button>
          </>
        )}
      </div>
    );
  };

  const baseUrl = origin || "https://your-portal-domain";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">API Keys</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Keys let trusted outside programs read portal data. Each key only sees the programs
            you tick, and can be revoked at any time.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Key
        </button>
      </div>

      {message && (
        <div
          className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
          }`}
        >
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, key prefix, notes or creator..."
            className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FilterMultiSelect
            label="Status"
            options={STATUS_OPTIONS}
            selected={statusFilter}
            onChange={setStatusFilter}
            fullWidth
            matchInputStyle
          />
          <FilterMultiSelect
            label="Access"
            options={scopeFilterOptions}
            selected={scopeFilter}
            onChange={setScopeFilter}
            fullWidth
            matchInputStyle
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Showing {filtered.length} of {keys.length}
          </span>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors ${
              hasActiveFilters
                ? "cursor-pointer border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                : "cursor-not-allowed border border-transparent text-gray-400 dark:text-gray-600"
            }`}
          >
            <X className="h-3.5 w-3.5" /> Clear Filters
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-12 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading API keys...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <KeyRound className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {keys.length === 0
              ? "No API keys yet. Create one to share data with another program."
              : "No keys match these filters."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Key</th>
                  <th className="px-4 py-3">Access</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Last Used</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map((key) => {
                  const status = keyStatus(key);
                  return (
                    <tr key={key.id} className="align-top text-gray-700 dark:text-gray-300">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{key.name}</div>
                        {key.notes && (
                          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {key.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{key.keyPrefix}…</td>
                      <td className="px-4 py-3">{renderScopes(key.scopes)}</td>
                      <td className="px-4 py-3 text-xs">
                        <div>{formatDate(key.createdAt)}</div>
                        <div className="text-gray-500 dark:text-gray-400">
                          {key.createdBy?.name || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div>{formatDateTime(key.lastUsedAt)}</div>
                        {key.usageCount > 0 && (
                          <div className="text-gray-500 dark:text-gray-400">
                            {key.usageCount.toLocaleString()} requests
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[status]}`}
                        >
                          {status}
                        </span>
                        {key.expiresAt && status === "Active" && (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Expires {formatDate(key.expiresAt)}
                          </div>
                        )}
                        {key.revokedAt && (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(key.revokedAt)}
                            {key.revokedBy?.name ? ` by ${key.revokedBy.name}` : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">{renderActions(key)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((key) => {
              const status = keyStatus(key);
              return (
                <div
                  key={key.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{key.name}</div>
                      <div className="font-mono text-xs text-gray-500">{key.keyPrefix}…</div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[status]}`}
                    >
                      {status}
                    </span>
                  </div>
                  {key.notes && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{key.notes}</p>
                  )}
                  <div className="mt-2">{renderScopes(key.scopes)}</div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Created {formatDate(key.createdAt)}
                    {key.createdBy?.name ? ` by ${key.createdBy.name}` : ""} · Last used{" "}
                    {formatDateTime(key.lastUsedAt)}
                  </div>
                  <div className="mt-3 border-t border-gray-100 pt-2 dark:border-gray-700">
                    {renderActions(key)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Developer quick reference */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <button
          type="button"
          onClick={() => setShowDocs((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white"
        >
          Developer quick reference
          {showDocs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showDocs && (
          <div className="space-y-3 border-t border-gray-200 px-4 py-4 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">
            <p>
              Send the key in the <code className="font-mono">Authorization</code> header. All
              endpoints are read-only and return JSON.
            </p>
            <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 font-mono text-xs text-gray-100">
{`curl -H "Authorization: Bearer <API_KEY>" \\
  "${baseUrl}/api/v1/accessories/items?status=DELIVERED"`}
            </pre>
            <ul className="space-y-1 font-mono text-xs">
              <li>GET /api/v1/ping — check the key and its access</li>
              <li>GET /api/v1/fabrication-orders — list (filters: updatedSince, jobNumber, dealId, search)</li>
              <li>GET /api/v1/fabrication-orders/&#123;id or order #&#125; — full layout</li>
              <li>GET /api/v1/accessories/items — items (filters: status, updatedSince, jobNumber, department)</li>
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Full details are in API_ACCESS.md at the root of the portal repository.
            </p>
          </div>
        )}
      </div>

      {/* Create / edit modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {form.id ? "Edit API Key" : "Create API Key"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitForm} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Jobsite AI – production"
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div>
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Access
                </span>
                <div className="space-y-2">
                  {API_SCOPES.map((scope) => (
                    <label
                      key={scope.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900/50"
                    >
                      <input
                        type="checkbox"
                        checked={form.scopes.includes(scope.id)}
                        onChange={() => toggleScope(scope.id)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">
                          {scope.label}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {scope.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Expires (optional)
                  </label>
                  <input
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notes (optional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="Who uses it and what for"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {form.id ? "Save Changes" : "Create Key"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Show-once secret modal */}
      {newSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl dark:bg-gray-800">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Copy the key for &quot;{newSecret.name}&quot;
              </h2>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  This is the only time the full key is shown. Send it to the developer through
                  a private channel (not a group chat or email thread). If it&apos;s lost, revoke
                  it and create a new one.
                </span>
              </div>
              <div className="flex items-stretch gap-2">
                <input
                  readOnly
                  value={newSecret.secret}
                  onFocus={(e) => e.target.select()}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 font-mono text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={copySecret}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm text-white hover:bg-blue-700"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setNewSecret(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  I&apos;ve saved it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

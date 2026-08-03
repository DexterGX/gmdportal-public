"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Settings2, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { StoreTaxonomy } from "../types";

type ArchivedItem = { id: string; name: string; quantity: number; unit: string; isActive: boolean };
type ArchivedProvider = { id: string; name: string; isActive: boolean };

function ArchivedPanel<T extends { id: string; name: string }>({
  title,
  description,
  emptyLabel,
  entries,
  onRestore,
  onDelete,
  renderMeta,
}: {
  title: string;
  description: string;
  emptyLabel: string;
  entries: T[];
  onRestore: (entry: T) => void;
  onDelete: (entry: T) => void;
  renderMeta?: (entry: T) => string | null;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      <h2 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{description}</p>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const meta = renderMeta?.(entry) ?? null;
            return (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md border border-gray-200 dark:border-gray-700"
              >
                <div className="min-w-0">
                  <div className="text-sm text-gray-900 dark:text-gray-100 truncate">{entry.name}</div>
                  {meta && <div className="text-xs text-gray-500 dark:text-gray-400">{meta}</div>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onRestore(entry)}
                    title="Restore"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore
                  </button>
                  <button
                    onClick={() => onDelete(entry)}
                    title="Delete Permanently"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaxonomyPanel({
  title,
  description,
  endpoint,
  items,
  onChanged,
}: {
  title: string;
  description: string;
  endpoint: string;
  items: StoreTaxonomy[];
  onChanged: () => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!newLabel.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to add");
      }
      setNewLabel("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: StoreTaxonomy) {
    try {
      await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
      });
      onChanged();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      <h2 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{description}</p>

      <div className="space-y-2 mb-4">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">None yet.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 p-2 rounded-md border border-gray-200 dark:border-gray-700"
            >
              <span
                className={`text-sm ${item.isActive ? "text-gray-900 dark:text-gray-100" : "text-gray-400 line-through"}`}
              >
                {item.label}
              </span>
              <button
                onClick={() => toggleActive(item)}
                className={`text-xs px-2 py-1 rounded-md font-medium ${
                  item.isActive
                    ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                }`}
              >
                {item.isActive ? "Active" : "Inactive"}
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="New name..."
          className="flex-1 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !newLabel.trim()}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export default function SettingsClient() {
  const [departments, setDepartments] = useState<StoreTaxonomy[]>([]);
  const [groups, setGroups] = useState<StoreTaxonomy[]>([]);
  const [archivedItems, setArchivedItems] = useState<ArchivedItem[]>([]);
  const [archivedProviders, setArchivedProviders] = useState<ArchivedProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [deptRes, groupRes, itemsRes, providersRes] = await Promise.all([
        fetch("/api/store-inventory/departments"),
        fetch("/api/store-inventory/groups"),
        fetch("/api/store-inventory/items?includeInactive=true"),
        fetch("/api/store-inventory/providers?includeInactive=true"),
      ]);
      setDepartments(await deptRes.json());
      setGroups(await groupRes.json());
      const items = await itemsRes.json();
      const providers = await providersRes.json();
      setArchivedItems(Array.isArray(items) ? items.filter((i: ArchivedItem) => !i.isActive) : []);
      setArchivedProviders(Array.isArray(providers) ? providers.filter((p: ArchivedProvider) => !p.isActive) : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleRestoreItem(item: ArchivedItem) {
    try {
      const res = await fetch(`/api/store-inventory/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) throw new Error();
      showToast("success", `"${item.name}" restored`);
      fetchAll();
    } catch {
      showToast("error", "Failed to restore item");
    }
  }

  async function handleDeleteItem(item: ArchivedItem) {
    if (
      !confirm(
        `Permanently delete "${item.name}"? This cannot be undone and will also delete all of its transaction and restock history.`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/store-inventory/items/${item.id}?hard=true`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast("success", `"${item.name}" deleted`);
      fetchAll();
    } catch {
      showToast("error", "Failed to delete item");
    }
  }

  async function handleRestoreProvider(provider: ArchivedProvider) {
    try {
      const res = await fetch(`/api/store-inventory/providers/${provider.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) throw new Error();
      showToast("success", `"${provider.name}" restored`);
      fetchAll();
    } catch {
      showToast("error", "Failed to restore provider");
    }
  }

  async function handleDeleteProvider(provider: ArchivedProvider) {
    if (
      !confirm(
        `Permanently delete "${provider.name}"? This cannot be undone. Linked items will keep their history but lose this vendor link.`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/store-inventory/providers/${provider.id}?hard=true`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast("success", `"${provider.name}" deleted`);
      fetchAll();
    } catch {
      showToast("error", "Failed to delete provider");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}

      <Link
        href="/store-inventory"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Store Inventory
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Settings2 className="w-7 h-7" />
          Store Inventory Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage the Department and Group lists items can be tagged with.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <TaxonomyPanel
          title="Departments"
          description="Who uses the item (Cabinet Shop, Countertop Shop, Installation...)."
          endpoint="/api/store-inventory/departments"
          items={departments}
          onChanged={fetchAll}
        />
        <TaxonomyPanel
          title="Groups"
          description="What kind of item it is (LEDs, Plumbing, Adhesives...)."
          endpoint="/api/store-inventory/groups"
          items={groups}
          onChanged={fetchAll}
        />
      </div>

      <div className="mb-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Archived</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Items and vendors that were archived. Restore them to bring them back, or delete permanently to remove them for good.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ArchivedPanel
          title={`Archived Items (${archivedItems.length})`}
          description="Hidden from Overview and Check Out until restored."
          emptyLabel="No archived items."
          entries={archivedItems}
          onRestore={handleRestoreItem}
          onDelete={handleDeleteItem}
          renderMeta={(entry) => `${entry.quantity} ${entry.unit} on hand`}
        />
        <ArchivedPanel
          title={`Archived Vendors (${archivedProviders.length})`}
          description="Hidden from the Providers directory until restored."
          emptyLabel="No archived vendors."
          entries={archivedProviders}
          onRestore={handleRestoreProvider}
          onDelete={handleDeleteProvider}
        />
      </div>
    </div>
  );
}

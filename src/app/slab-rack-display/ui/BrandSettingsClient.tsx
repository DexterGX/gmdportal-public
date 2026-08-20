"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

type Brand = {
  id: string;
  name: string;
  isActive: boolean;
};

export default function BrandSettingsClient() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newBrandName, setNewBrandName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadBrands = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/slab-rack-display/brands?all=1");
      if (!response.ok) throw new Error("Failed to load brands.");
      const data = (await response.json()) as Brand[];
      setBrands(data);
    } catch {
      setError("Could not load brands. Please refresh and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBrands();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const visibleBrands = useMemo(() => {
    const sorted = [...brands].sort((a, b) => a.name.localeCompare(b.name));
    return showArchived ? sorted : sorted.filter((brand) => brand.isActive);
  }, [brands, showArchived]);

  const handleCreate = async () => {
    const name = newBrandName.trim();
    if (!name) {
      setError("Enter a brand name first.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/slab-rack-display/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error("Failed to add brand.");
      setNewBrandName("");
      setNotice(`"${name}" added.`);
      await loadBrands();
    } catch {
      setError("Could not add this brand. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (brand: Brand) => {
    setError(null);
    try {
      const response = await fetch("/api/slab-rack-display/brands", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: brand.id, isActive: !brand.isActive }),
      });
      if (!response.ok) throw new Error("Failed to update brand.");
      setNotice(
        brand.isActive
          ? `"${brand.name}" archived.`
          : `"${brand.name}" restored.`,
      );
      await loadBrands();
    } catch {
      setError("Could not update this brand. Please try again.");
    }
  };

  const handleDelete = async (brand: Brand) => {
    setError(null);
    try {
      const response = await fetch(
        `/api/slab-rack-display/brands?id=${encodeURIComponent(brand.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Failed to delete brand.");
      setNotice(`"${brand.name}" permanently deleted.`);
      setConfirmDeleteId(null);
      await loadBrands();
    } catch {
      setError("Could not delete this brand. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
          Brand Settings
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage the brand list offered on the SlabBay Add Slab form. Brands
          typed into &quot;Other&quot; are added here automatically so they
          can be picked directly next time.
        </p>
      </div>

      {notice && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={newBrandName}
            onChange={(event) => setNewBrandName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleCreate();
            }}
            placeholder="New brand name"
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            {isSaving ? "Adding..." : "Add brand"}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Brands ({visibleBrands.length})
          </h2>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Show archived
          </label>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading brands...
            </p>
          </div>
        ) : visibleBrands.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {showArchived
              ? "No brands yet. Add one above."
              : "No active brands. Add one above, or check “Show archived”."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-800">
            {visibleBrands.map((brand) => (
              <li
                key={brand.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <span
                  className={`text-sm ${
                    brand.isActive
                      ? "text-gray-900 dark:text-gray-100"
                      : "text-gray-400 dark:text-gray-600 line-through"
                  }`}
                >
                  {brand.name}
                  {!brand.isActive && (
                    <span className="ml-2 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                      Archived
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(brand)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    {brand.isActive ? "Archive" : "Restore"}
                  </button>
                  {confirmDeleteId === brand.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleDelete(brand)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Confirm delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(brand.id)}
                      title="Permanently delete"
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

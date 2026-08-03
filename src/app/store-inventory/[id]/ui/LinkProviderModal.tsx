"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type ProviderOption = { id: string; name: string };

interface Props {
  itemId: string;
  existingProviderIds: string[];
  onClose: () => void;
  onLinked: () => void;
}

export default function LinkProviderModal({ itemId, existingProviderIds, onClose, onLinked }: Props) {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [providerId, setProviderId] = useState("");
  const [providerSku, setProviderSku] = useState("");
  const [purchaseLink, setPurchaseLink] = useState("");
  const [cost, setCost] = useState("");
  const [isPreferred, setIsPreferred] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/store-inventory/providers")
      .then((r) => r.json())
      .then((data) => setProviders(Array.isArray(data) ? data : []))
      .catch(() => setProviders([]));
  }, []);

  const availableProviders = providers.filter((p) => !existingProviderIds.includes(p.id));

  async function handleSubmit() {
    if (!providerId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/store-inventory/items/${itemId}/providers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          providerSku: providerSku || undefined,
          purchaseLink: purchaseLink || undefined,
          cost: cost ? Number(cost) : undefined,
          isPreferred,
        }),
      });
      if (!res.ok) throw new Error();
      onLinked();
    } catch {
      // no-op; parent shows generic toast on failure paths elsewhere
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Link Provider</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {availableProviders.length === 0 && providers.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No providers exist yet. Add one from the Providers directory first.
          </p>
        ) : availableProviders.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            All existing providers are already linked to this item.
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Provider</label>
              <select
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="">Select a provider</option>
                {availableProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Provider SKU</label>
                <input
                  value={providerSku}
                  onChange={(e) => setProviderSku(e.target.value)}
                  className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Cost</label>
                <input
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Purchase Link</label>
              <input
                value={purchaseLink}
                onChange={(e) => setPurchaseLink(e.target.value)}
                placeholder="https://..."
                className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={isPreferred}
                onChange={(e) => setIsPreferred(e.target.checked)}
                className="w-4 h-4"
              />
              Mark as preferred provider
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !providerId}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Linking..." : "Link Provider"}
          </button>
        </div>
      </div>
    </div>
  );
}

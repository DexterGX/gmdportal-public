"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, Globe, MapPin, Star, Pencil, Archive, Trash2 } from "lucide-react";
import ProviderFormModal, { type ProviderFormValues } from "../ui/ProviderFormModal";

type ProviderDetail = {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  items: {
    id: string;
    isPreferred: boolean;
    providerSku: string | null;
    cost: number | null;
    purchaseLink: string | null;
    item: { id: string; name: string; unit: string; quantity: number };
  }[];
};

export default function ProviderDetailClient({ providerId }: { providerId: string }) {
  const router = useRouter();
  const [provider, setProvider] = useState<ProviderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchProvider = useCallback(async () => {
    try {
      const res = await fetch(`/api/store-inventory/providers/${providerId}`);
      if (res.status === 404) {
        setProvider(null);
        return;
      }
      const data = await res.json();
      setProvider(data);
    } catch (error) {
      console.error(error);
      showToast("error", "Failed to load provider");
    } finally {
      setLoading(false);
    }
  }, [providerId, showToast]);

  useEffect(() => {
    fetchProvider();
  }, [fetchProvider]);

  async function handleSave(values: ProviderFormValues) {
    try {
      const res = await fetch(`/api/store-inventory/providers/${providerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed to update provider");
      setShowEditModal(false);
      showToast("success", "Provider updated");
      fetchProvider();
    } catch (error) {
      showToast("error", "Failed to update provider");
    }
  }

  async function handleArchive() {
    if (!provider) return;
    if (!confirm(`Archive "${provider.name}"? It will be hidden from the active list, but linked item history is kept. You can restore it later from Settings.`)) return;
    try {
      const res = await fetch(`/api/store-inventory/providers/${providerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to archive provider");
      showToast("success", "Provider archived");
      router.push("/store-inventory/providers");
    } catch (error) {
      showToast("error", "Failed to archive provider");
    }
  }

  async function handleDelete() {
    if (!provider) return;
    if (
      !confirm(
        `Permanently delete "${provider.name}"? This cannot be undone. Linked items will keep their history but lose this vendor link.`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/store-inventory/providers/${providerId}?hard=true`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete provider");
      showToast("success", "Provider deleted");
      router.push("/store-inventory/providers");
    } catch (error) {
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

  if (!provider) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Provider not found.</p>
        <Link href="/store-inventory/providers" className="text-blue-600 hover:underline">
          Back to Providers
        </Link>
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
        href="/store-inventory/providers"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Providers
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{provider.name}</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={handleArchive}
            className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 dark:border-red-900/50 rounded-md text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            <Archive className="w-4 h-4" />
            Archive
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 dark:border-red-900/50 rounded-md text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6 space-y-1 text-sm text-gray-700 dark:text-gray-300">
        {provider.contactName && <div>Contact: {provider.contactName}</div>}
        {provider.contactPhone && (
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> {provider.contactPhone}
          </div>
        )}
        {provider.contactEmail && (
          <div className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> {provider.contactEmail}
          </div>
        )}
        {provider.website && (
          <a href={provider.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 w-fit">
            <Globe className="w-3.5 h-3.5" /> {provider.website}
          </a>
        )}
        {provider.address && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> {provider.address}
          </div>
        )}
        {provider.notes && <div className="pt-2 text-gray-500 dark:text-gray-400">{provider.notes}</div>}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Linked Items ({provider.items.length})</h2>
        {provider.items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No items linked to this provider yet.</p>
        ) : (
          <div className="space-y-2">
            {provider.items.map((link) => (
              <Link
                key={link.id}
                href={`/store-inventory/${link.item.id}`}
                className="flex items-center justify-between gap-3 py-2 text-sm border-b border-gray-100 dark:border-gray-700 last:border-0 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <div className="flex items-center gap-2">
                  {link.isPreferred && <Star className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />}
                  <span className="font-medium text-gray-900 dark:text-gray-100">{link.item.name}</span>
                  {link.providerSku && <span className="text-xs text-gray-500 dark:text-gray-400">SKU: {link.providerSku}</span>}
                </div>
                <span className="text-gray-500 dark:text-gray-400">
                  {link.item.quantity} {link.item.unit} on hand
                  {link.cost != null ? ` · $${link.cost.toFixed(2)}` : ""}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showEditModal && (
        <ProviderFormModal
          provider={provider}
          onClose={() => setShowEditModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

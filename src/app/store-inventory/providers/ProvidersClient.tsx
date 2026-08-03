"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Truck, Mail, Phone, Globe, Pencil, Archive, Trash2 } from "lucide-react";
import ProviderFormModal, { type ProviderFormValues } from "./ui/ProviderFormModal";

type Provider = {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  _count: { items: number };
};

export default function ProvidersClient({ canManage }: { canManage: boolean }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/store-inventory/providers");
      const data = await res.json();
      setProviders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  function openNew() {
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(provider: Provider) {
    setEditing(provider);
    setShowModal(true);
  }

  async function handleSave(values: ProviderFormValues) {
    try {
      const isEdit = Boolean(editing);
      const res = await fetch(isEdit ? `/api/store-inventory/providers/${editing!.id}` : "/api/store-inventory/providers", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save provider");
      }
      setShowModal(false);
      showToast("success", isEdit ? "Provider updated" : "Provider added");
      fetchProviders();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to save provider");
    }
  }

  async function handleArchive(provider: Provider) {
    if (!confirm(`Archive "${provider.name}"? You can restore it later from Settings.`)) return;
    try {
      const res = await fetch(`/api/store-inventory/providers/${provider.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast("success", "Provider archived");
      fetchProviders();
    } catch {
      showToast("error", "Failed to archive provider");
    }
  }

  async function handleDelete(provider: Provider) {
    if (
      !confirm(
        `Permanently delete "${provider.name}"? This cannot be undone. Items linked to it will keep their history but lose this vendor link.`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/store-inventory/providers/${provider.id}?hard=true`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast("success", "Provider deleted");
      fetchProviders();
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
    <div className="max-w-5xl mx-auto">
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

      <div className="flex justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Providers</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Vendors and suppliers for store inventory items.</p>
        </div>
        {canManage && (
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Provider
          </button>
        )}
      </div>

      {providers.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No providers yet</p>
          {canManage && (
            <button onClick={openNew} className="inline-block mt-4 text-blue-600 hover:text-blue-700">
              Add your first provider
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((provider) => (
            <div key={provider.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <Link
                  href={`/store-inventory/providers/${provider.id}`}
                  className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {provider.name}
                </Link>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  {provider._count.items} item{provider._count.items === 1 ? "" : "s"}
                </span>
              </div>
              {provider.contactName && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{provider.contactName}</div>
              )}
              <div className="flex flex-col gap-1 text-sm text-gray-500 dark:text-gray-400">
                {provider.contactPhone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    {provider.contactPhone}
                  </span>
                )}
                {provider.contactEmail && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    {provider.contactEmail}
                  </span>
                )}
                {provider.website && (
                  <a
                    href={provider.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {provider.website}
                  </a>
                )}
              </div>
              {canManage && (
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => openEdit(provider)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleArchive(provider)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Archive
                  </button>
                  <button
                    onClick={() => handleDelete(provider)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ProviderFormModal provider={editing} onClose={() => setShowModal(false)} onSave={handleSave} />
      )}
    </div>
  );
}

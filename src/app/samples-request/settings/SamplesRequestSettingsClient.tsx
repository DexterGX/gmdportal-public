"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Save, RotateCcw } from "lucide-react";
import {
  createSampleRequestProvider,
  updateSampleRequestProvider,
  deleteSampleRequestProvider,
  type SampleRequestProvider,
  type SampleRequestType,
} from "@/lib/samplesRequests";

interface Props {
  initialProviders: SampleRequestProvider[];
}

const emptyForm = {
  name: "",
  sampleType: "CABINET" as SampleRequestType,
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  contactMethod: "",
  notes: "",
  isActive: true,
};

export default function SamplesRequestSettingsClient({
  initialProviders,
}: Props) {
  const [providers, setProviders] = useState<SampleRequestProvider[]>(
    initialProviders,
  );
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sortedProviders = useMemo(() => {
    return [...providers].sort((a, b) => {
      if (a.sampleType !== b.sampleType) {
        return a.sampleType.localeCompare(b.sampleType);
      }
      return a.name.localeCompare(b.name);
    });
  }, [providers]);

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setError(null);
  };

  const startEdit = (provider: SampleRequestProvider) => {
    setEditingId(provider.id);
    setForm({
      name: provider.name,
      sampleType: provider.sampleType,
      contactName: provider.contactName || "",
      contactPhone: provider.contactPhone || "",
      contactEmail: provider.contactEmail || "",
      contactMethod: provider.contactMethod || "",
      notes: provider.notes || "",
      isActive: provider.isActive,
    });
    setMessage(null);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (!form.name.trim()) {
        throw new Error("Provider name is required.");
      }

      if (editingId) {
        const updated = await updateSampleRequestProvider({
          id: editingId,
          name: form.name,
          sampleType: form.sampleType,
          contactName: form.contactName || null,
          contactPhone: form.contactPhone || null,
          contactEmail: form.contactEmail || null,
          contactMethod: form.contactMethod || null,
          notes: form.notes || null,
          isActive: form.isActive,
        });

        setProviders((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
        setMessage("Provider updated.");
      } else {
        const created = await createSampleRequestProvider({
          name: form.name,
          sampleType: form.sampleType,
          contactName: form.contactName || undefined,
          contactPhone: form.contactPhone || undefined,
          contactEmail: form.contactEmail || undefined,
          contactMethod: form.contactMethod || undefined,
          notes: form.notes || undefined,
          isActive: form.isActive,
        });
        setProviders((prev) => [...prev, created]);
        setMessage("Provider added.");
      }

      resetForm();
    } catch (err: any) {
      setError(err?.message || "Failed to save provider.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (provider: SampleRequestProvider) => {
    if (!confirm(`Delete ${provider.name}?`)) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await deleteSampleRequestProvider(provider.id);
      setProviders((prev) => prev.filter((item) => item.id !== provider.id));
      setMessage("Provider deleted.");
    } catch (err: any) {
      setError(err?.message || "Failed to delete provider.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sample Providers Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage brands/providers and their contact instructions.
        </p>
      </div>

      {(error || message) && (
        <div
          className={`rounded-md border p-3 text-sm ${
            error
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-green-50 border-green-200 text-green-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Provider Name
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900"
              placeholder="e.g. Fabuwood"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sample Type
            </label>
            <select
              value={form.sampleType}
              onChange={(e) =>
                setForm({
                  ...form,
                  sampleType: e.target.value as SampleRequestType,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900"
            >
              <option value="CABINET">Cabinet</option>
              <option value="COUNTERTOP">Countertop</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contact Name
            </label>
            <input
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contact Phone
            </label>
            <input
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contact Email
            </label>
            <input
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contact Method
            </label>
            <input
              value={form.contactMethod}
              onChange={(e) =>
                setForm({ ...form, contactMethod: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900"
              placeholder="Phone, email, portal, etc"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            How we get it
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active
        </label>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {editingId ? "Save changes" : "Add provider"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
            >
              <RotateCcw className="w-4 h-4" />
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-gray-500" />
          <h2 className="text-lg font-semibold">Providers</h2>
        </div>
        {sortedProviders.length === 0 ? (
          <div className="text-sm text-gray-500">No providers yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Contact</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4">Active</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedProviders.map((provider) => (
                  <tr
                    key={provider.id}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    <td className="py-3 pr-4 font-medium">{provider.name}</td>
                    <td className="py-3 pr-4">{provider.sampleType}</td>
                    <td className="py-3 pr-4">
                      <div>{provider.contactName || "—"}</div>
                      <div className="text-xs text-gray-500">
                        {provider.contactEmail || provider.contactPhone || ""}
                      </div>
                    </td>
                    <td className="py-3 pr-4">{provider.contactMethod || "—"}</td>
                    <td className="py-3 pr-4">
                      {provider.isActive ? "Yes" : "No"}
                    </td>
                    <td className="py-3 pr-4">
                      <button
                        type="button"
                        onClick={() => startEdit(provider)}
                        className="text-blue-600 hover:underline mr-3"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(provider)}
                        className="text-red-600 hover:underline"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

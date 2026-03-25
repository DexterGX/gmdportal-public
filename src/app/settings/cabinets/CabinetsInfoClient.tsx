"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Edit,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
  X,
  Download,
} from "lucide-react";

type CabinetProvider = {
  id: string;
  actualName: string;
  displayName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  id?: string;
  actualName: string;
  displayName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  actualName: "",
  displayName: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  address: "",
  isActive: true,
};

export default function CabinetsInfoClient({
  initialProviders,
}: {
  initialProviders: CabinetProvider[];
}) {
  const [providers, setProviders] =
    useState<CabinetProvider[]>(initialProviders);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadProviders = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      params.set("active", activeFilter);

      const response = await fetch(
        `/api/settings/cabinets?${params.toString()}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load cabinet providers");
      }

      setProviders(data.providers || []);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to load cabinet providers.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadProviders();
    }, 250);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, activeFilter]);

  const clearFilters = () => {
    setSearch("");
    setActiveFilter("all");
  };

  const resetForm = () => {
    setForm(emptyForm);
    setIsEditing(false);
  };

  const startEdit = (provider: CabinetProvider) => {
    setForm({
      id: provider.id,
      actualName: provider.actualName,
      displayName: provider.displayName,
      contactName: provider.contactName || "",
      contactPhone: provider.contactPhone || "",
      contactEmail: provider.contactEmail || "",
      address: provider.address || "",
      isActive: provider.isActive,
    });
    setIsEditing(true);
    setMessage(null);
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.actualName.trim() || !form.displayName.trim()) {
      setMessage({
        type: "error",
        text: "Actual name and display name are required.",
      });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const method = isEditing ? "PATCH" : "POST";
      const response = await fetch("/api/settings/cabinets", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          actualName: form.actualName,
          displayName: form.displayName,
          contactName: form.contactName || null,
          contactPhone: form.contactPhone || null,
          contactEmail: form.contactEmail || null,
          address: form.address || null,
          isActive: form.isActive,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save provider");
      }

      setMessage({
        type: "success",
        text: isEditing
          ? "Cabinet provider updated."
          : "Cabinet provider added.",
      });

      resetForm();
      await loadProviders();
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to save cabinet provider.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProvider = async (provider: CabinetProvider) => {
    if (!confirm(`Delete provider ${provider.displayName}?`)) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/cabinets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: provider.id }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete provider");
      }

      setMessage({ type: "success", text: "Cabinet provider deleted." });
      await loadProviders();
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to delete cabinet provider.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      [
        "Actual Name",
        "Display Name",
        "Contact",
        "Phone",
        "Email",
        "Address",
        "Status",
      ],
      ...providers.map((p) => [
        p.actualName,
        p.displayName,
        p.contactName || "",
        p.contactPhone || "",
        p.contactEmail || "",
        p.address || "",
        p.isActive ? "Active" : "Inactive",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "cabinet_providers.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasFilters = useMemo(
    () => search.trim().length > 0 || activeFilter !== "all",
    [search, activeFilter],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Cabinets Info
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Manage cabinet provider actual/display names and contact details for
          reuse across programs.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <form
        onSubmit={submitForm}
        className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditing ? "Edit Provider" : "Add Provider"}
          </h2>
          {isEditing && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              <X className="w-4 h-4" />
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Provider Actual Name
            </label>
            <input
              value={form.actualName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, actualName: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
              placeholder="e.g. Fabuwood Cabinetry Corp"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Provider Display Name
            </label>
            <input
              value={form.displayName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, displayName: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
              placeholder="e.g. Fabuwood"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contact
            </label>
            <input
              value={form.contactName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contactName: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone
            </label>
            <input
              value={form.contactPhone}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contactPhone: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              value={form.contactEmail}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contactEmail: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
              type="email"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address
            </label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, address: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, isActive: e.target.checked }))
              }
            />
            Active
          </label>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {isEditing ? (
            <Save className="w-4 h-4" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {isSaving
            ? "Saving..."
            : isEditing
              ? "Save provider"
              : "Add provider"}
        </button>
      </form>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-1 flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search provider, contact, email..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
              />
            </div>

            <select
              value={activeFilter}
              onChange={(e) =>
                setActiveFilter(e.target.value as "all" | "active" | "inactive")
              }
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>

            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
            >
              Clear filters
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Actual Name</th>
                <th className="px-4 py-3 text-left font-medium">
                  Display Name
                </th>
                <th className="px-4 py-3 text-left font-medium">Contact</th>
                <th className="px-4 py-3 text-left font-medium">Address</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    Loading cabinet providers...
                  </td>
                </tr>
              ) : providers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    No providers found for the current filters.
                  </td>
                </tr>
              ) : (
                providers.map((provider) => (
                  <tr
                    key={provider.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  >
                    <td className="px-4 py-3 text-gray-900 dark:text-white">
                      {provider.actualName}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                      {provider.displayName}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      <div>{provider.contactName || "-"}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {provider.contactPhone || ""}{" "}
                        {provider.contactEmail
                          ? `| ${provider.contactEmail}`
                          : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {provider.address || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          provider.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {provider.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => startEdit(provider)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteProvider(provider)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

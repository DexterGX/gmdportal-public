"use client";

import { useMemo, useState } from "react";
import { Edit, Plus, Save, Search, Trash2, X } from "lucide-react";

type Row = {
  id: string;
  brandNumber?: number | null;
  name: string;
  logoUrl: string | null;
  factor: number;
  taxFactor: number;
  freight: number;
  discount: number;
  contactName: string | null;
  contactCell: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  createdAt: string;
  updatedAt: string;
  _dirty?: boolean;
  _deleted?: boolean;
  _isNew?: boolean;
};

export default function SinkBrandSettingsTable({
  initialData,
}: {
  initialData: Row[];
}) {
  const [rows, setRows] = useState<Row[]>(initialData);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const hasChanges = rows.some(
    (row) => row._dirty || row._deleted || row._isNew,
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(
      (row) => !row._deleted && row.name.toLowerCase().includes(term),
    );
  }, [rows, search]);

  function patchRow(id: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, ...patch, _dirty: true } : row,
      ),
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        brandNumber: null,
        name: "",
        logoUrl: null,
        factor: 1,
        taxFactor: 1,
        freight: 0,
        discount: 0,
        contactName: null,
        contactCell: null,
        contactPhone: null,
        contactEmail: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _dirty: true,
        _isNew: true,
      },
    ]);
  }

  async function uploadLogo(brandId: string, file: File) {
    setUploadingFor(brandId);
    try {
      const formData = new FormData();
      formData.append("brandId", brandId);
      formData.append("file", file);
      const res = await fetch("/api/sinks/admin/brand-logo-upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to upload logo");
      }
      patchRow(brandId, { logoUrl: String(json?.logoUrl || "") });
    } catch (error: any) {
      alert(error?.message || "Failed to upload logo");
    } finally {
      setUploadingFor(null);
    }
  }

  async function saveAll() {
    setIsSaving(true);
    try {
      const changed = rows.filter(
        (row) => row._dirty || row._deleted || row._isNew,
      );
      const response = await fetch("/api/sinks/admin/brands/bulk-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brands: changed }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || "Failed to save brand settings");
      }
      window.location.reload();
    } catch (error: any) {
      alert(error?.message || "Failed to save brand settings");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by brand name..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
            />
          </div>

          <div className="flex gap-2">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveAll}
                  disabled={!hasChanges || isSaving}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-2 text-sm text-gray-500">
          {hasChanges ? "You have unsaved changes" : "All changes saved"}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-3 py-2 text-left">Brand ID</th>
              <th className="px-3 py-2 text-left">Brand</th>
              <th className="px-3 py-2 text-left">Logo</th>
              <th className="px-3 py-2 text-left">Factor</th>
              <th className="px-3 py-2 text-left">Tax Factor</th>
              <th className="px-3 py-2 text-left">Freight</th>
              <th className="px-3 py-2 text-left">Discount</th>
              <th className="px-3 py-2 text-left">Contact</th>
              <th className="px-3 py-2 text-left">Email</th>
              {isEditing ? (
                <th className="px-3 py-2 text-left">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.id}
                className="border-t border-gray-100 dark:border-gray-700"
              >
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                  {row.brandNumber ?? "-"}
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      value={row.name}
                      onChange={(event) =>
                        patchRow(row.id, { name: event.target.value })
                      }
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded"
                    />
                  ) : (
                    row.name
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {row.logoUrl ? (
                      <img
                        src={row.logoUrl}
                        alt={row.name}
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : null}
                    {isEditing ? (
                      <label className="text-xs text-blue-600 hover:underline cursor-pointer">
                        {uploadingFor === row.id ? "Uploading..." : "Upload"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            uploadLogo(row.id, file);
                          }}
                        />
                      </label>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.0001"
                      value={row.factor}
                      onChange={(event) =>
                        patchRow(row.id, {
                          factor: Number(event.target.value) || 1,
                        })
                      }
                      className="w-24 px-2 py-1 border rounded"
                    />
                  ) : (
                    row.factor.toFixed(4)
                  )}
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.0001"
                      value={row.taxFactor}
                      onChange={(event) =>
                        patchRow(row.id, {
                          taxFactor: Number(event.target.value) || 1,
                        })
                      }
                      className="w-24 px-2 py-1 border rounded"
                    />
                  ) : (
                    row.taxFactor.toFixed(4)
                  )}
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.01"
                      value={row.freight}
                      onChange={(event) =>
                        patchRow(row.id, {
                          freight: Number(event.target.value) || 0,
                        })
                      }
                      className="w-24 px-2 py-1 border rounded"
                    />
                  ) : (
                    row.freight.toFixed(2)
                  )}
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.0001"
                      value={row.discount}
                      onChange={(event) =>
                        patchRow(row.id, {
                          discount: Number(event.target.value) || 0,
                        })
                      }
                      className="w-24 px-2 py-1 border rounded"
                    />
                  ) : (
                    row.discount.toFixed(4)
                  )}
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <div className="space-y-1">
                      <input
                        value={row.contactName || ""}
                        onChange={(event) =>
                          patchRow(row.id, {
                            contactName: event.target.value || null,
                          })
                        }
                        placeholder="Name"
                        className="w-full px-2 py-1 border rounded"
                      />
                      <input
                        value={row.contactCell || ""}
                        onChange={(event) =>
                          patchRow(row.id, {
                            contactCell: event.target.value || null,
                          })
                        }
                        placeholder="Cell"
                        className="w-full px-2 py-1 border rounded"
                      />
                      <input
                        value={row.contactPhone || ""}
                        onChange={(event) =>
                          patchRow(row.id, {
                            contactPhone: event.target.value || null,
                          })
                        }
                        placeholder="Phone"
                        className="w-full px-2 py-1 border rounded"
                      />
                    </div>
                  ) : (
                    <div className="text-xs">
                      <div>{row.contactName || "-"}</div>
                      <div>{row.contactCell || "-"}</div>
                      <div>{row.contactPhone || "-"}</div>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      value={row.contactEmail || ""}
                      onChange={(event) =>
                        patchRow(row.id, {
                          contactEmail: event.target.value || null,
                        })
                      }
                      className="w-full px-2 py-1 border rounded"
                    />
                  ) : (
                    row.contactEmail || "-"
                  )}
                </td>
                {isEditing ? (
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        const confirmed = window.confirm(
                          "Delete this brand? This is only allowed if no sinks are linked to it.",
                        );
                        if (!confirmed) {
                          return;
                        }

                        setRows((prev) =>
                          prev.map((item) =>
                            item.id === row.id
                              ? { ...item, _deleted: true, _dirty: true }
                              : item,
                          ),
                        );
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>

        {isEditing ? (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Brand
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

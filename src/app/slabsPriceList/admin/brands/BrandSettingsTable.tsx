"use client";

import React, { useState, useEffect } from "react";
import { Save, X, Edit, Plus, Search, Trash2 } from "lucide-react";

// Type matching the new schema structure
type BrandSettingsRow = {
  id: string;
  brandNumber: number | null;
  brandName: string;
  logoUrl: string | null;
  factor: number;
  tax: number;
  freight: number;
  discount: number;
  contactName: string | null;
  contactCell: string | null;
  contactPhone: string | null;
  email: string | null;
  lastUpdated: string | null;
  _dirty?: boolean;
  _isNew?: boolean;
  _deleted?: boolean;
};

interface BrandSettingsTableProps {
  initialData: BrandSettingsRow[];
}

export default function BrandSettingsTable({
  initialData,
}: BrandSettingsTableProps) {
  const [rows, setRows] = useState<BrandSettingsRow[]>(initialData);
  const [originalRows, setOriginalRows] =
    useState<BrandSettingsRow[]>(initialData);
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadingLogoFor, setUploadingLogoFor] = useState<string | null>(null);

  // Unsaved changes protection
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  const handleFieldChange = (
    id: string,
    field: keyof BrandSettingsRow,
    value: any
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          return { ...row, [field]: value, _dirty: true };
        }
        return row;
      })
    );
    setHasChanges(true);
  };

  const handleAddNew = () => {
    const newRow: BrandSettingsRow = {
      id: `new-${Date.now()}`,
      brandNumber: null, // Let server assign ID to avoid duplicates
      brandName: "",
      logoUrl: null,
      factor: 1.0,
      tax: 1.07, // Tax factor style (not percentage)
      freight: 0,
      discount: 0,
      contactName: null,
      contactCell: null,
      contactPhone: null,
      email: null,
      lastUpdated: null,
      _isNew: true,
      _dirty: true,
    };
    setRows((prev) => [...prev, newRow]);
    setHasChanges(true);
  };

  const handleLogoChange = async (
    brandId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingLogoFor(brandId);
    try {
      const formData = new FormData();
      formData.append("brandId", brandId);
      formData.append("file", file);

      const res = await fetch("/api/slabs/admin/brand-logo-upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to upload logo");
      }

      const data = (await res.json()) as { logoUrl: string };

      // Update local brand state with new logoUrl
      setRows((prev) =>
        prev.map((b) => (b.id === brandId ? { ...b, logoUrl: data.logoUrl } : b))
      );
    } catch (error) {
      console.error("Logo upload error:", error);
      alert("Failed to upload logo");
    } finally {
      setUploadingLogoFor(null);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this brand?")) return;

    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, _deleted: true, _dirty: true } : row
      )
    );
    setHasChanges(true);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowId: string,
    isLastCell: boolean
  ) => {
    if (e.key === "Enter" && isLastCell) {
      e.preventDefault();
      const rowIndex = rows.findIndex((r) => r.id === rowId);
      const isLastRow = rowIndex === rows.length - 1;
      if (isLastRow) {
        handleAddNew();
      }
    }
  };

  const handleCancel = () => {
    if (hasChanges && !confirm("Discard all unsaved changes?")) {
      return;
    }
    setRows(originalRows);
    setIsEditing(false);
    setHasChanges(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    const changedRows = rows.filter(
      (row) => row._dirty || row._isNew || row._deleted
    );
    if (changedRows.length === 0) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/slabs/admin/brands/bulk-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brands: changedRows }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      const { brands: updatedBrands } = await response.json();

      setHasChanges(false);
      setIsEditing(false);
      alert("Changes saved successfully!");

      // Reload page to fetch fresh data from server
      window.location.reload();
    } catch (error: any) {
      alert(`Error saving changes: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter rows by search query and exclude deleted rows
  const filteredRows = rows.filter(
    (row) =>
      !row._deleted &&
      row.brandName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header with Search and Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Search Bar */}
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by brand name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : "Save all changes"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status Indicator */}
        <div className="mt-2 text-sm">
          {hasChanges ? (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              You have unsaved changes
            </span>
          ) : (
            <span className="text-gray-600 dark:text-gray-400">
              All changes saved
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Brand ID</th>
                <th className="px-4 py-3 text-left font-medium">Brand</th>
                <th className="px-4 py-3 text-left font-medium">Logo</th>
                <th className="px-4 py-3 text-left font-medium">Factor</th>
                <th className="px-4 py-3 text-left font-medium">Tax Factor</th>
                <th className="px-4 py-3 text-left font-medium">Freight</th>
                <th className="px-4 py-3 text-left font-medium">Discount</th>
                <th className="px-4 py-3 text-left font-medium">
                  Contact Name
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Contact Cell
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Contact Phone
                </th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">
                  Last Updated
                </th>
                {isEditing && (
                  <th className="px-4 py-3 text-left font-medium w-16"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className={`${
                    row._dirty || row._isNew
                      ? "bg-amber-50 dark:bg-amber-900/10"
                      : ""
                  } hover:bg-gray-50 dark:hover:bg-gray-700/50`}
                >
                  <td className="px-4 py-3">
                    <span className="text-gray-900 dark:text-white">
                      {row.brandNumber ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.brandName}
                        onChange={(e) =>
                          handleFieldChange(row.id, "brandName", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-white font-medium">
                        {row.brandName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {row.logoUrl && (
                        <img
                          src={row.logoUrl}
                          alt={`${row.brandName} logo`}
                          className="h-10 w-10 rounded object-cover"
                        />
                      )}
                      <label className="cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:underline">
                        {uploadingLogoFor === row.id ? "Uploading..." : "Upload"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleLogoChange(row.id, e)}
                          disabled={uploadingLogoFor === row.id}
                        />
                      </label>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.0001"
                        value={row.factor}
                        onChange={(e) =>
                          handleFieldChange(
                            row.id,
                            "factor",
                            parseFloat(e.target.value) || 1
                          )
                        }
                        className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-white">
                        {row.factor.toFixed(4)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="1.07"
                        value={row.tax}
                        onChange={(e) =>
                          handleFieldChange(
                            row.id,
                            "tax",
                            parseFloat(e.target.value) || 1
                          )
                        }
                        className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-white">
                        {row.tax.toFixed(4)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={row.freight}
                        onChange={(e) =>
                          handleFieldChange(
                            row.id,
                            "freight",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-white">
                        ${row.freight.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.0001"
                        value={row.discount}
                        onChange={(e) =>
                          handleFieldChange(
                            row.id,
                            "discount",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-white">
                        {row.discount.toFixed(4)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.contactName ?? ""}
                        onChange={(e) =>
                          handleFieldChange(
                            row.id,
                            "contactName",
                            e.target.value || null
                          )
                        }
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-white">
                        {row.contactName ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.contactCell ?? ""}
                        onChange={(e) =>
                          handleFieldChange(
                            row.id,
                            "contactCell",
                            e.target.value || null
                          )
                        }
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-white">
                        {row.contactCell ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.contactPhone ?? ""}
                        onChange={(e) =>
                          handleFieldChange(
                            row.id,
                            "contactPhone",
                            e.target.value || null
                          )
                        }
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-white">
                        {row.contactPhone ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="email"
                        value={row.email ?? ""}
                        onChange={(e) =>
                          handleFieldChange(
                            row.id,
                            "email",
                            e.target.value || null
                          )
                        }
                        onKeyDown={(e) => handleKeyDown(e, row.id, true)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-white">
                        {row.email ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {row.lastUpdated
                      ? new Date(row.lastUpdated).toLocaleDateString()
                      : "—"}
                  </td>
                  {isEditing && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete brand"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {/* Add New Row */}
              {isEditing && (
                <tr className="bg-blue-50 dark:bg-blue-900/10 border-t-2 border-blue-200 dark:border-blue-800">
                  <td colSpan={12} className="px-4 py-3">
                    <button
                      onClick={handleAddNew}
                      className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                    >
                      <Plus className="w-5 h-5" />
                      Add New Brand
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredRows.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            {searchQuery
              ? `No brands found matching "${searchQuery}"`
              : "No brand configurations found."}
          </div>
        )}
      </div>
    </div>
  );
}

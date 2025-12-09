"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Save,
  X,
  Edit,
  Plus,
  Search,
  ChevronUp,
  ChevronDown,
  Filter,
  Trash2,
} from "lucide-react";
import MultiSelectDropdown, {
  MultiSelectOption,
} from "../../ui/MultiSelectDropdown";

type ThicknessOption = "8mm" | "12mm" | "2cm" | "3cm";
type SlabStatusOption = "AVAILABLE" | "UNAVAILABLE" | "DISCONTINUED";

type AdminSlabRow = {
  id: string;
  slabNumber: number | null;
  brand: string;
  brandId: string;
  series: string | null;
  code: string | null;
  color: string;
  finish: string;
  heightIn: number;
  widthIn: number;
  thickness: ThicknessOption;
  listedPrice: number;
  finalPrice: number;
  status: SlabStatusOption;
  _dirty?: boolean;
  _isNew?: boolean;
  _deleted?: boolean;
};

type SlabBrand = {
  id: string;
  name: string;
};

type SortColumn = keyof AdminSlabRow | null;
type SortDirection = "asc" | "desc";

interface SlabsAdminTableProps {
  initialData: AdminSlabRow[];
  brands: SlabBrand[];
  finishes: string[];
}

const THICKNESS_OPTIONS: ThicknessOption[] = ["8mm", "12mm", "2cm", "3cm"];
const STATUS_OPTIONS: SlabStatusOption[] = [
  "AVAILABLE",
  "UNAVAILABLE",
  "DISCONTINUED",
];

export default function SlabsAdminTable({
  initialData,
  brands,
  finishes,
}: SlabsAdminTableProps) {
  const [rows, setRows] = useState<AdminSlabRow[]>(initialData);
  const [originalRows, setOriginalRows] = useState<AdminSlabRow[]>(initialData);
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Search and filters - changed to multi-select arrays
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBrands, setFilterBrands] = useState<string[]>([]);
  const [filterSeries, setFilterSeries] = useState<string[]>([]);
  const [filterFinishes, setFilterFinishes] = useState<string[]>([]);
  const [filterHxWs, setFilterHxWs] = useState<string[]>([]);
  const [filterThicknesses, setFilterThicknesses] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);

  // Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn>("color");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

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

  // Get unique values for filters
  const uniqueSeries = useMemo(() => {
    const series = rows
      .map((r) => r.series)
      .filter((s) => s !== null) as string[];
    return [...new Set(series)].sort();
  }, [rows]);

  const uniqueHxW = useMemo(() => {
    const hxw = rows.map((r) => `${r.heightIn} x ${r.widthIn} in`);
    return [...new Set(hxw)].sort();
  }, [rows]);

  const handleFieldChange = (
    id: string,
    field: keyof AdminSlabRow,
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
    const newRow: AdminSlabRow = {
      id: `new-${Date.now()}`,
      slabNumber: null, // Let server assign ID to avoid duplicates
      brand: brands[0]?.name || "",
      brandId: brands[0]?.id || "",
      series: null,
      code: null,
      color: "",
      finish: finishes[0] || "POLISHED",
      heightIn: 0,
      widthIn: 0,
      thickness: "2cm",
      listedPrice: 0,
      finalPrice: 0,
      status: "AVAILABLE",
      _isNew: true,
      _dirty: true,
    };
    setRows((prev) => [...prev, newRow]);
    setHasChanges(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this slab?")) return;

    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, _deleted: true, _dirty: true } : row
      )
    );
    setHasChanges(true);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
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
      const response = await fetch("/api/slabs/admin/slabs/bulk-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slabs: changedRows }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      const { slabs: updatedSlabs } = await response.json();

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

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        // Reset to default
        setSortColumn("color");
        setSortDirection("asc");
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterBrands([]);
    setFilterSeries([]);
    setFilterFinishes([]);
    setFilterHxWs([]);
    setFilterThicknesses([]);
    setFilterStatuses([]);
  };

  // Apply filters and sorting
  const filteredAndSortedRows = useMemo(() => {
    let filtered = rows.filter((row) => !row._deleted); // Exclude deleted rows

    // Search by color
    if (searchQuery) {
      filtered = filtered.filter((row) =>
        row.color.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply multi-select filters
    if (filterBrands.length > 0) {
      filtered = filtered.filter((row) => filterBrands.includes(row.brand));
    }
    if (filterSeries.length > 0) {
      filtered = filtered.filter(
        (row) => row.series && filterSeries.includes(row.series)
      );
    }
    if (filterFinishes.length > 0) {
      filtered = filtered.filter((row) => filterFinishes.includes(row.finish));
    }
    if (filterHxWs.length > 0) {
      filtered = filtered.filter((row) =>
        filterHxWs.includes(`${row.heightIn} x ${row.widthIn} in`)
      );
    }
    if (filterThicknesses.length > 0) {
      filtered = filtered.filter((row) =>
        filterThicknesses.includes(row.thickness)
      );
    }
    if (filterStatuses.length > 0) {
      filtered = filtered.filter((row) => filterStatuses.includes(row.status));
    }

    // Sort
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;

        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortDirection === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        }

        return 0;
      });
    }

    return filtered;
  }, [
    rows,
    searchQuery,
    filterBrands,
    filterSeries,
    filterFinishes,
    filterHxWs,
    filterThicknesses,
    filterStatuses,
    sortColumn,
    sortDirection,
  ]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with Search and Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          {/* Search Bar */}
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by color..."
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

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <MultiSelectDropdown
            label="Brand"
            options={brands.map((b) => ({ value: b.name, label: b.name }))}
            selectedValues={filterBrands}
            onChange={setFilterBrands}
          />

          <MultiSelectDropdown
            label="Series"
            options={uniqueSeries.map((s) => ({ value: s, label: s }))}
            selectedValues={filterSeries}
            onChange={setFilterSeries}
          />

          <MultiSelectDropdown
            label="Finish"
            options={finishes.map((f) => ({
              value: f,
              label: f.replace("_", " "),
            }))}
            selectedValues={filterFinishes}
            onChange={setFilterFinishes}
          />

          <MultiSelectDropdown
            label="Size"
            options={uniqueHxW.map((h) => ({ value: h, label: h }))}
            selectedValues={filterHxWs}
            onChange={setFilterHxWs}
          />

          <MultiSelectDropdown
            label="Thickness"
            options={THICKNESS_OPTIONS.map((t) => ({ value: t, label: t }))}
            selectedValues={filterThicknesses}
            onChange={setFilterThicknesses}
          />

          <MultiSelectDropdown
            label="Status"
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
            selectedValues={filterStatuses}
            onChange={setFilterStatuses}
          />
        </div>

        {(searchQuery ||
          filterBrands.length > 0 ||
          filterSeries.length > 0 ||
          filterFinishes.length > 0 ||
          filterHxWs.length > 0 ||
          filterThicknesses.length > 0 ||
          filterStatuses.length > 0) && (
          <button
            onClick={clearFilters}
            className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
          >
            Clear all filters
          </button>
        )}

        {/* Status Indicator */}
        <div className="mt-3 text-sm">
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
                <th
                  className="px-3 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("slabNumber")}
                >
                  Slab ID <SortIcon column="slabNumber" />
                </th>
                <th
                  className="px-3 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("brand")}
                >
                  Brand <SortIcon column="brand" />
                </th>
                <th
                  className="px-3 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("series")}
                >
                  Series <SortIcon column="series" />
                </th>
                <th
                  className="px-3 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("code")}
                >
                  Code <SortIcon column="code" />
                </th>
                <th
                  className="px-3 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("color")}
                >
                  Color <SortIcon column="color" />
                </th>
                <th
                  className="px-3 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("finish")}
                >
                  Finish <SortIcon column="finish" />
                </th>
                <th className="px-3 py-3 text-left font-medium">H x W</th>
                <th
                  className="px-3 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("thickness")}
                >
                  Thickness <SortIcon column="thickness" />
                </th>
                <th
                  className="px-3 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("listedPrice")}
                >
                  Listed Price <SortIcon column="listedPrice" />
                </th>
                <th
                  className="px-3 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("finalPrice")}
                >
                  Final Price <SortIcon column="finalPrice" />
                </th>
                <th
                  className="px-3 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort("status")}
                >
                  Status <SortIcon column="status" />
                </th>
                {isEditing && (
                  <th className="px-3 py-3 text-left font-medium w-16"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAndSortedRows.map((row) => (
                <tr
                  key={row.id}
                  className={`${
                    row._dirty || row._isNew
                      ? "bg-amber-50 dark:bg-amber-900/10"
                      : ""
                  } hover:bg-gray-50 dark:hover:bg-gray-700/50`}
                >
                  <td className="px-3 py-3">
                    <span className="text-gray-900 dark:text-white">
                      {row.slabNumber ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {isEditing ? (
                      <select
                        value={row.brandId}
                        onChange={(e) => {
                          const selectedBrand = brands.find(
                            (b) => b.id === e.target.value
                          );
                          if (selectedBrand) {
                            handleFieldChange(
                              row.id,
                              "brandId",
                              selectedBrand.id
                            );
                            handleFieldChange(
                              row.id,
                              "brand",
                              selectedBrand.name
                            );
                          }
                        }}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      >
                        {brands.map((brand) => (
                          <option key={brand.id} value={brand.id}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-gray-900 dark:text-white font-medium">
                        {row.brand}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.series ?? ""}
                        onChange={(e) =>
                          handleFieldChange(
                            row.id,
                            "series",
                            e.target.value || null
                          )
                        }
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-white">
                        {row.series ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.code ?? ""}
                        onChange={(e) =>
                          handleFieldChange(
                            row.id,
                            "code",
                            e.target.value || null
                          )
                        }
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-white">
                        {row.code ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.color}
                        onChange={(e) =>
                          handleFieldChange(row.id, "color", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-white">
                        {row.color}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {isEditing ? (
                      <select
                        value={row.finish}
                        onChange={(e) =>
                          handleFieldChange(row.id, "finish", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      >
                        {finishes.map((finish) => (
                          <option key={finish} value={finish}>
                            {finish.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-gray-900 dark:text-white">
                        {row.finish.replace("_", " ")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={row.heightIn}
                          onChange={(e) =>
                            handleFieldChange(
                              row.id,
                              "heightIn",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="H"
                          className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-gray-500">x</span>
                        <input
                          type="number"
                          step="0.01"
                          value={row.widthIn}
                          onChange={(e) =>
                            handleFieldChange(
                              row.id,
                              "widthIn",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="W"
                          className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ) : (
                      <span className="text-gray-900 dark:text-white">
                        {row.heightIn} x {row.widthIn} in
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {isEditing ? (
                      <select
                        value={row.thickness}
                        onChange={(e) =>
                          handleFieldChange(
                            row.id,
                            "thickness",
                            e.target.value as ThicknessOption
                          )
                        }
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      >
                        {THICKNESS_OPTIONS.map((thickness) => (
                          <option key={thickness} value={thickness}>
                            {thickness}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-gray-900 dark:text-white">
                        {row.thickness}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={row.listedPrice}
                        onChange={(e) =>
                          handleFieldChange(
                            row.id,
                            "listedPrice",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-white">
                        {formatCurrency(row.listedPrice)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-gray-600 dark:text-gray-400">
                      {formatCurrency(row.finalPrice)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {isEditing ? (
                      <select
                        value={row.status}
                        onChange={(e) =>
                          handleFieldChange(
                            row.id,
                            "status",
                            e.target.value as SlabStatusOption
                          )
                        }
                        onKeyDown={(e) => handleKeyDown(e, row.id, true)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          row.status === "AVAILABLE"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : row.status === "UNAVAILABLE"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {row.status}
                      </span>
                    )}
                  </td>
                  {isEditing && (
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete slab"
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
                  <td colSpan={12} className="px-3 py-3">
                    <button
                      onClick={handleAddNew}
                      className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                    >
                      <Plus className="w-5 h-5" />
                      Add New Slab
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredAndSortedRows.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            No slabs found matching your filters.
          </div>
        )}
      </div>
    </div>
  );
}

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
} from "lucide-react";

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

  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBrand, setFilterBrand] = useState<string>("");
  const [filterSeries, setFilterSeries] = useState<string>("");
  const [filterFinish, setFilterFinish] = useState<string>("");
  const [filterHxW, setFilterHxW] = useState<string>("");
  const [filterThickness, setFilterThickness] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

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
      slabNumber: null,
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
    const changedRows = rows.filter((row) => row._dirty || row._isNew);
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

      setRows(updatedSlabs);
      setOriginalRows(updatedSlabs);
      setHasChanges(false);
      setIsEditing(false);
      alert("Changes saved successfully!");
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
    setFilterBrand("");
    setFilterSeries("");
    setFilterFinish("");
    setFilterHxW("");
    setFilterThickness("");
    setFilterStatus("");
  };

  // Apply filters and sorting
  const filteredAndSortedRows = useMemo(() => {
    let filtered = rows;

    // Search by color
    if (searchQuery) {
      filtered = filtered.filter((row) =>
        row.color.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply filters
    if (filterBrand) {
      filtered = filtered.filter((row) => row.brand === filterBrand);
    }
    if (filterSeries) {
      filtered = filtered.filter((row) => row.series === filterSeries);
    }
    if (filterFinish) {
      filtered = filtered.filter((row) => row.finish === filterFinish);
    }
    if (filterHxW) {
      filtered = filtered.filter(
        (row) => `${row.heightIn} x ${row.widthIn} in` === filterHxW
      );
    }
    if (filterThickness) {
      filtered = filtered.filter((row) => row.thickness === filterThickness);
    }
    if (filterStatus) {
      filtered = filtered.filter((row) => row.status === filterStatus);
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
    filterBrand,
    filterSeries,
    filterFinish,
    filterHxW,
    filterThickness,
    filterStatus,
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Brands</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.name}>
                {brand.name}
              </option>
            ))}
          </select>

          <select
            value={filterSeries}
            onChange={(e) => setFilterSeries(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Series</option>
            {uniqueSeries.map((series) => (
              <option key={series} value={series}>
                {series}
              </option>
            ))}
          </select>

          <select
            value={filterFinish}
            onChange={(e) => setFilterFinish(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Finishes</option>
            {finishes.map((finish) => (
              <option key={finish} value={finish}>
                {finish.replace("_", " ")}
              </option>
            ))}
          </select>

          <select
            value={filterHxW}
            onChange={(e) => setFilterHxW(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sizes</option>
            {uniqueHxW.map((hxw) => (
              <option key={hxw} value={hxw}>
                {hxw}
              </option>
            ))}
          </select>

          <select
            value={filterThickness}
            onChange={(e) => setFilterThickness(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Thicknesses</option>
            {THICKNESS_OPTIONS.map((thickness) => (
              <option key={thickness} value={thickness}>
                {thickness}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {(searchQuery ||
          filterBrand ||
          filterSeries ||
          filterFinish ||
          filterHxW ||
          filterThickness ||
          filterStatus) && (
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
                    {isEditing ? (
                      <input
                        type="number"
                        value={row.slabNumber ?? ""}
                        onChange={(e) =>
                          handleFieldChange(
                            row.id,
                            "slabNumber",
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                        className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-white">
                        {row.slabNumber ?? "—"}
                      </span>
                    )}
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
                </tr>
              ))}

              {/* Add New Row */}
              {isEditing && (
                <tr className="bg-blue-50 dark:bg-blue-900/10 border-t-2 border-blue-200 dark:border-blue-800">
                  <td colSpan={11} className="px-3 py-3">
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

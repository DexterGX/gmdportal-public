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
  Printer,
} from "lucide-react";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";

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
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
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
  initialTotal,
  initialPage,
  initialPageSize,
  brands,
  finishes,
}: SlabsAdminTableProps) {
  const [rows, setRows] = useState<AdminSlabRow[]>(initialData);
  const [originalRows, setOriginalRows] = useState<AdminSlabRow[]>(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [isLoading, setIsLoading] = useState(false);
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

  // Fetch data from API with current filters/sort/pagination
  const fetchSlabs = async () => {
    if (isEditing) return; // Don't fetch during editing

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (searchQuery) params.set("search", searchQuery);
      if (filterBrands.length > 0) params.set("brandIds", brands.filter(b => filterBrands.includes(b.name)).map(b => b.id).join(","));
      if (filterSeries.length > 0) params.set("series", filterSeries.join(","));
      if (filterFinishes.length > 0) params.set("finishes", filterFinishes.join(","));
      if (filterHxWs.length > 0) params.set("hxws", filterHxWs.join(","));
      if (filterThicknesses.length > 0) params.set("thicknesses", filterThicknesses.join(","));
      if (filterStatuses.length > 0) params.set("statuses", filterStatuses.join(","));
      if (sortColumn) params.set("sortBy", sortColumn);
      params.set("sortDir", sortDirection);
      params.set("page", currentPage.toString());
      params.set("pageSize", pageSize.toString());

      const response = await fetch(`/api/slabs/admin?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch slabs");
      }

      const data = await response.json();
      setRows(data.rows);
      setOriginalRows(data.rows);
      setTotal(data.total);
    } catch (error: any) {
      console.error("Error fetching slabs:", error);
      alert(`Failed to load slabs: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data when filters/sort/pagination change (but not during editing)
  useEffect(() => {
    if (!isEditing) {
      fetchSlabs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchQuery,
    filterBrands,
    filterSeries,
    filterFinishes,
    filterHxWs,
    filterThicknesses,
    filterStatuses,
    sortColumn,
    sortDirection,
    currentPage,
    pageSize,
    isEditing,
  ]);

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

      // Refetch data from server to show updated records
      await fetchSlabs();
    } catch (error: any) {
      alert(`Error saving changes: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSort = (column: SortColumn) => {
    setCurrentPage(1); // Reset to first page when sorting changes
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
    setCurrentPage(1); // Reset to first page
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    filterBrands.length > 0 ||
    filterSeries.length > 0 ||
    filterFinishes.length > 0 ||
    filterHxWs.length > 0 ||
    filterThicknesses.length > 0 ||
    filterStatuses.length > 0;

  // Finish values are stored/sent raw (e.g. "HONED_MATTE") but shown with
  // spaces instead of underscores — these two helpers keep FilterMultiSelect
  // (which only deals in plain strings) in sync with the raw values.
  const finishToDisplay = (value: string) => value.replace(/_/g, " ");
  const finishDisplayOptions = useMemo(
    () => finishes.map(finishToDisplay),
    [finishes]
  );
  const handleFinishFilterChange = (selectedDisplay: string[]) => {
    const raw = selectedDisplay
      .map((display) => finishes.find((f) => finishToDisplay(f) === display))
      .filter((f): f is string => Boolean(f));
    setFilterFinishes(raw);
  };

  // Printing — mirrors the History Log pattern (Print filtered / Print full
  // inventory). Unlike History Log, this table is server-paginated, so
  // "Print" here can't just reuse whatever's already loaded: the on-screen
  // page holds at most 500 of up to ~4600 rows. Both print modes fetch the
  // full matching set from the API first (there's no server-side pageSize
  // cap — see /api/slabs/admin), then print. "Print filtered" fetches every
  // row matching the current filters/search; "Print full inventory" ignores
  // filters entirely and fetches everything.
  const [printMode, setPrintMode] = useState<"filtered" | "all">("filtered");
  const [printRows, setPrintRows] = useState<AdminSlabRow[]>([]);
  const [printReady, setPrintReady] = useState(false);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);

  useEffect(() => {
    const resetPrint = () => {
      setPrintMode("filtered");
      setPrintReady(false);
    };
    window.addEventListener("afterprint", resetPrint);
    return () => window.removeEventListener("afterprint", resetPrint);
  }, []);

  const handlePrint = async (mode: "filtered" | "all") => {
    setIsPreparingPrint(true);
    try {
      const params = new URLSearchParams();
      if (mode === "filtered") {
        if (searchQuery) params.set("search", searchQuery);
        if (filterBrands.length > 0)
          params.set(
            "brandIds",
            brands
              .filter((b) => filterBrands.includes(b.name))
              .map((b) => b.id)
              .join(",")
          );
        if (filterSeries.length > 0)
          params.set("series", filterSeries.join(","));
        if (filterFinishes.length > 0)
          params.set("finishes", filterFinishes.join(","));
        if (filterHxWs.length > 0) params.set("hxws", filterHxWs.join(","));
        if (filterThicknesses.length > 0)
          params.set("thicknesses", filterThicknesses.join(","));
        if (filterStatuses.length > 0)
          params.set("statuses", filterStatuses.join(","));
      }
      if (sortColumn) params.set("sortBy", sortColumn);
      params.set("sortDir", sortDirection);
      params.set("page", "1");
      // No server-side cap on pageSize (see /api/slabs/admin) — request a
      // number comfortably above the full table size so one call returns
      // everything that matches.
      params.set("pageSize", "100000");

      const response = await fetch(`/api/slabs/admin?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load slabs for printing");

      const data = await response.json();
      setPrintRows(data.rows);
      setPrintMode(mode);
      setPrintReady(true);
      setTimeout(() => window.print(), 50);
    } catch (error: any) {
      alert(`Failed to prepare print: ${error.message}`);
    } finally {
      setIsPreparingPrint(false);
    }
  };

  // When in edit mode, we filter client-side; otherwise server handles it
  const displayRows = useMemo(() => {
    if (!isEditing) {
      // Server-side pagination/filtering - just show what we got
      return rows;
    }
    
    // During editing, apply client-side filters to show consistent UX
    let filtered = rows.filter((row) => !row._deleted);

    if (searchQuery) {
      filtered = filtered.filter((row) =>
        row.color.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

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

    // Sort client-side during editing
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
    isEditing,
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

  const printSourceRows = printReady ? printRows : displayRows;

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
    <div id="print-area" className="space-y-4 slabs-price-list-print">
      {/* Scoped to this route only (previously an unscoped global print rule
          in globals.css that leaked its list-style layout onto every other
          program's print output). Kept identical to how it printed before. */}
      <style>{`@page { size: auto; margin: 15mm 12mm 12mm 12mm; }`}</style>
      {/* "Printed by [user] on [date]" now lives in page.tsx, on the same
          line as the "Slab Data" title, since that title is rendered there. */}
      {/* Print-Only Filter Summary */}
      <div className="hidden print:block mb-2 p-2 border border-gray-300">
        <h3 className="font-semibold text-lg mb-1">
          {printMode === "all" ? "Full Inventory" : "Active Filters"}
        </h3>
        {printMode === "all" ? (
          <div className="text-sm text-gray-600">
            Printing the full inventory — all filters ignored for this printout.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 text-sm">
            {searchQuery && (
              <div>
                <strong>Search:</strong> {searchQuery}
              </div>
            )}
            {filterBrands.length > 0 && (
              <div>
                <strong>Brands:</strong> {filterBrands.join(", ")}
              </div>
            )}
            {filterSeries.length > 0 && (
              <div>
                <strong>Series:</strong> {filterSeries.join(", ")}
              </div>
            )}
            {filterFinishes.length > 0 && (
              <div>
                <strong>Finishes:</strong> {filterFinishes.join(", ")}
              </div>
            )}
            {filterHxWs.length > 0 && (
              <div>
                <strong>Sizes:</strong> {filterHxWs.join(", ")}
              </div>
            )}
            {filterThicknesses.length > 0 && (
              <div>
                <strong>Thickness:</strong> {filterThicknesses.join(", ")}
              </div>
            )}
            {filterStatuses.length > 0 && (
              <div>
                <strong>Status:</strong> {filterStatuses.join(", ")}
              </div>
            )}
            {!searchQuery &&
              filterBrands.length === 0 &&
              filterSeries.length === 0 &&
              filterFinishes.length === 0 &&
              filterHxWs.length === 0 &&
              filterThicknesses.length === 0 &&
              filterStatuses.length === 0 && (
                <div className="col-span-2 text-gray-600">No filters applied</div>
              )}
          </div>
        )}
        <div className="mt-1 pt-1 border-t border-gray-300 text-xs">
          <strong>Total in database:</strong> {initialTotal} |{" "}
          <strong>Slabs printed:</strong> {printSourceRows.length}
        </div>
      </div>

      {/* Header with Search and Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 print:hidden">
        {/* Search — typed filter, paired with Edit/Save/Cancel on the same line */}
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by color..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
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

        {/* Selectable filters, paired with Print/Clear on the same line */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterMultiSelect
              label="Brand"
              options={brands.map((b) => b.name)}
              selected={filterBrands}
              onChange={setFilterBrands}
            />

            <FilterMultiSelect
              label="Series"
              options={uniqueSeries}
              selected={filterSeries}
              onChange={setFilterSeries}
            />

            <FilterMultiSelect
              label="Finish"
              options={finishDisplayOptions}
              selected={filterFinishes.map(finishToDisplay)}
              onChange={handleFinishFilterChange}
            />

            <FilterMultiSelect
              label="Size"
              options={uniqueHxW}
              selected={filterHxWs}
              onChange={setFilterHxWs}
            />

            <FilterMultiSelect
              label="Thickness"
              options={THICKNESS_OPTIONS}
              selected={filterThicknesses}
              onChange={setFilterThicknesses}
            />

            <FilterMultiSelect
              label="Status"
              options={STATUS_OPTIONS}
              selected={filterStatuses}
              onChange={setFilterStatuses}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handlePrint("filtered")}
              disabled={isPreparingPrint}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Print every slab matching the current filters"
            >
              <Printer className="w-4 h-4" />
              {isPreparingPrint ? "Preparing..." : "Print filtered"}
            </button>
            <button
              onClick={() => handlePrint("all")}
              disabled={isPreparingPrint}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Print the entire inventory, ignoring current filters"
            >
              <Printer className="w-4 h-4" />
              Print full inventory
            </button>
            <button
              type="button"
              disabled={!hasActiveFilters}
              onClick={clearFilters}
              className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                hasActiveFilters
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              }`}
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>

        {/* Showing X of Y (left) + unsaved-changes status (right) — underneath the filters */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            Showing{" "}
            <span className="font-medium text-gray-900 dark:text-white">
              {displayRows.length}
            </span>{" "}
            of{" "}
            <span className="font-medium text-gray-900 dark:text-white">
              {total}
            </span>{" "}
            slabs
          </span>
          <span className="text-sm">
            {hasChanges ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                You have unsaved changes
              </span>
            ) : (
              <span className="text-gray-600 dark:text-gray-400">
                All changes saved
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Table — screen-only. Printing uses a separate, simpler table below
          (see printSourceRows) since Print can hold many more rows than are
          ever loaded/paginated on screen. */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden print:hidden">
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
              {displayRows.map((row) => (
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
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full print-bg print:rounded-none print:border print:border-gray-400 ${
                          row.status === "AVAILABLE"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 print:bg-green-50 print:text-black"
                            : row.status === "UNAVAILABLE"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 print:bg-yellow-50 print:text-black"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 print:bg-red-50 print:text-black"
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

        {isLoading ? (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 print:hidden">
            Loading slabs...
          </div>
        ) : displayRows.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            No slabs found matching your filters.
          </div>
        ) : null}

        {/* Pagination and Info Footer */}
        {!isEditing && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between print:hidden">
            {/* Showing X of Y slabs */}
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing <span className="font-medium text-gray-900 dark:text-white">{displayRows.length}</span> of{" "}
              <span className="font-medium text-gray-900 dark:text-white">{total}</span> slabs
            </div>

            {/* Pagination Controls */}
            {total > pageSize && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isLoading}
                  className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page <span className="font-medium text-gray-900 dark:text-white">{currentPage}</span> of{" "}
                  <span className="font-medium text-gray-900 dark:text-white">{Math.ceil(total / pageSize)}</span>
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(Math.ceil(total / pageSize), p + 1))}
                  disabled={currentPage >= Math.ceil(total / pageSize) || isLoading}
                  className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>

                {/* Page Size Selector */}
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  disabled={isLoading}
                  className="ml-4 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                  <option value="200">200 per page</option>
                  <option value="500">500 per page</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Print-only table — a separate, simpler table (no editing controls,
          no pagination) fed by printSourceRows so a print can hold every
          row that matches (Print filtered) or the entire inventory (Print
          full inventory), not just whatever page is on screen. Styled by
          the .slabs-price-list-print rules in globals.css, which target
          any table under this #print-area (same 11 columns as before). */}
      <div className="hidden print:block bg-white border border-gray-300">
        <table className="w-full">
          <thead>
            <tr>
              <th>Slab ID</th>
              <th>Brand</th>
              <th>Series</th>
              <th>Code</th>
              <th>Color</th>
              <th>Finish</th>
              <th>H x W</th>
              <th>Thickness</th>
              <th>Listed Price</th>
              <th>Final Price</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {printSourceRows.map((row) => (
              <tr key={row.id}>
                <td>{row.slabNumber ?? "—"}</td>
                <td>{row.brand}</td>
                <td>{row.series ?? "—"}</td>
                <td>{row.code ?? "—"}</td>
                <td>{row.color}</td>
                <td>{finishToDisplay(row.finish)}</td>
                <td>
                  {row.heightIn} x {row.widthIn} in
                </td>
                <td>{row.thickness}</td>
                <td>{formatCurrency(row.listedPrice)}</td>
                <td>{formatCurrency(row.finalPrice)}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import type { SlabBrandConfig, Slab } from "@prisma/client";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";

type SerializedSlab = Omit<
  Slab,
  "widthIn" | "heightIn" | "providerPrice" | "finalPrice"
> & {
  widthIn: number;
  heightIn: number;
  providerPrice: number;
  finalPrice: number;
};

type SerializedBrand = Omit<
  SlabBrandConfig,
  "profitFactor" | "taxRate" | "deliveryFee" | "discount"
> & {
  profitFactor: number;
  taxRate: number;
  deliveryFee: number;
  discount: number;
  isAdmin: boolean;
  notes: Array<{
    id: string;
    title: string;
    content: string;
    catalogUrl: string | null;
    createdAt: string;
  }>;
  slabs: SerializedSlab[];
};

type FilterOptions = {
  series: string[];
  finishes: string[];
  thicknesses: string[];
  statuses: string[];
  sizes: string[];
};

type Props = {
  brand: SerializedBrand;
  filterOptions: FilterOptions;
};

// Helper functions
function formatFinish(finish: string): string {
  return finish
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatThickness(thickness: string): string {
  switch (thickness) {
    case "TWO_CM":
      return "2cm";
    case "THREE_CM":
      return "3cm";
    case "EIGHT_MM":
      return "8mm";
    case "TWELVE_MM":
      return "12mm";
    default:
      return thickness;
  }
}

function formatSize(heightIn: number, widthIn: number): string {
  return `${Math.round(heightIn)} x ${Math.round(widthIn)} in`;
}

function calculateSquareFeet(heightIn: number, widthIn: number): string {
  const sqFt = (heightIn * widthIn) / 144; // Convert square inches to square feet
  return sqFt.toFixed(2);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function BrandPriceListClient({ brand, filterOptions }: Props) {
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [notes, setNotes] = useState(brand.notes);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(
    brand.notes[0]?.id ?? null,
  );
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteCatalogUrl, setNoteCatalogUrl] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [selectedFinishes, setSelectedFinishes] = useState<string[]>([]);
  const [selectedThicknesses, setSelectedThicknesses] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [sortField, setSortField] = useState<keyof SerializedSlab | "sf">(
    "color",
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (field: keyof SerializedSlab | "sf") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: keyof SerializedSlab | "sf") => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3 ml-1 text-blue-600" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 text-blue-600" />
    );
  };

  const filteredSlabs = useMemo(() => {
    let filtered = brand.slabs.filter((slab) => {
      const series = slab.series ?? "";
      const finish = formatFinish(slab.finish);
      const thickness = formatThickness(slab.thickness);
      const size = formatSize(slab.heightIn, slab.widthIn);
      const status = slab.status;

      // TEXT SEARCH: color, series, or code (case-insensitive)
      const term = searchTerm.trim().toLowerCase();
      if (term) {
        const haystack = `${slab.color} ${series} ${
          slab.providerCode ?? ""
        }`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      // SERIES FILTER
      if (selectedSeries.length > 0 && !selectedSeries.includes(series)) {
        return false;
      }

      // FINISH FILTER
      if (selectedFinishes.length > 0 && !selectedFinishes.includes(finish)) {
        return false;
      }

      // THICKNESS FILTER
      if (
        selectedThicknesses.length > 0 &&
        !selectedThicknesses.includes(thickness)
      ) {
        return false;
      }

      // STATUS FILTER
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(status)) {
        return false;
      }

      // SIZE FILTER
      if (selectedSizes.length > 0 && !selectedSizes.includes(size)) {
        return false;
      }

      return true;
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      let comparison = 0;

      if (sortField === "sf") {
        const sfA = (a.heightIn * a.widthIn) / 144;
        const sfB = (b.heightIn * b.widthIn) / 144;
        comparison = sfA - sfB;
      } else if (sortField === "series") {
        comparison = (a.series ?? "").localeCompare(b.series ?? "");
      } else if (sortField === "providerCode") {
        comparison = (a.providerCode ?? "").localeCompare(b.providerCode ?? "");
      } else if (sortField === "color") {
        comparison = a.color.localeCompare(b.color);
      } else if (sortField === "finish") {
        comparison = a.finish.localeCompare(b.finish);
      } else if (sortField === "thickness") {
        comparison = a.thickness.localeCompare(b.thickness);
      } else if (sortField === "finalPrice") {
        comparison = a.finalPrice - b.finalPrice;
      } else if (sortField === "status") {
        comparison = a.status.localeCompare(b.status);
      } else if (sortField === "heightIn" || sortField === "widthIn") {
        comparison = a[sortField] - b[sortField];
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [
    brand.slabs,
    searchTerm,
    selectedSeries,
    selectedFinishes,
    selectedThicknesses,
    selectedStatuses,
    selectedSizes,
    sortField,
    sortDirection,
  ]);

  const clearFilters = () => {
    setSelectedSeries([]);
    setSelectedFinishes([]);
    setSelectedThicknesses([]);
    setSelectedStatuses([]);
    setSelectedSizes([]);
  };

  const hasActiveFilters =
    selectedSeries.length > 0 ||
    selectedFinishes.length > 0 ||
    selectedThicknesses.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedSizes.length > 0;

  async function handleCreateNote() {
    const title = noteTitle.trim();
    const content = noteContent.trim();
    const catalogUrl = noteCatalogUrl.trim();

    if (!title || !content) {
      setNoteError("Title and content are required.");
      return;
    }

    setIsSavingNote(true);
    setNoteError(null);
    try {
      const res = await fetch("/api/slabs/admin/brand-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: brand.id,
          title,
          content,
          catalogUrl,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to create note");
      }

      const created = json?.note;
      if (created) {
        setNotes((prev) => [created, ...prev]);
        setExpandedNoteId(created.id);
      }

      setNoteTitle("");
      setNoteContent("");
      setNoteCatalogUrl("");
      setIsAddNoteOpen(false);
    } catch (error: any) {
      setNoteError(error?.message || "Failed to create note");
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    setDeletingNoteId(noteId);
    setNoteError(null);
    try {
      const res = await fetch("/api/slabs/admin/brand-notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete note");
      }

      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      setExpandedNoteId((prev) => (prev === noteId ? null : prev));
    } catch (error: any) {
      setNoteError(error?.message || "Failed to delete note");
    } finally {
      setDeletingNoteId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/slabsPriceList"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Overview
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {brand.logoUrl && (
              <img
                src={brand.logoUrl}
                alt={`${brand.name} logo`}
                className="h-16 w-auto object-contain"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {brand.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                View current pricing for this provider.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsNotesOpen(true)}
            className="h-10 w-10 rounded-full bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-700 inline-flex items-center justify-center transition-colors"
            title="Important notes"
            aria-label="Open important notes"
          >
            <AlertTriangle className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="sticky top-16 z-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 shadow-sm">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by color, series, or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterMultiSelect
            label="Series"
            options={filterOptions.series}
            selected={selectedSeries}
            onChange={setSelectedSeries}
          />
          <FilterMultiSelect
            label="Finish"
            options={filterOptions.finishes}
            selected={selectedFinishes}
            onChange={setSelectedFinishes}
          />
          <FilterMultiSelect
            label="Size"
            options={filterOptions.sizes}
            selected={selectedSizes}
            onChange={setSelectedSizes}
          />
          <FilterMultiSelect
            label="Thickness"
            options={filterOptions.thicknesses}
            selected={selectedThicknesses}
            onChange={setSelectedThicknesses}
          />
          <FilterMultiSelect
            label="Status"
            options={filterOptions.statuses}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
          />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("series")}
                >
                  <div className="flex items-center justify-center">
                    Series
                    {getSortIcon("series")}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("providerCode")}
                >
                  <div className="flex items-center">
                    Code
                    {getSortIcon("providerCode")}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("color")}
                >
                  <div className="flex items-center">
                    Color
                    {getSortIcon("color")}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("finish")}
                >
                  <div className="flex items-center">
                    Finish
                    {getSortIcon("finish")}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("heightIn")}
                >
                  <div className="flex items-center justify-center">
                    H x W{getSortIcon("heightIn")}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("sf")}
                >
                  <div className="flex items-center justify-center">
                    SF
                    {getSortIcon("sf")}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("thickness")}
                >
                  <div className="flex items-center justify-center">
                    Thickness
                    {getSortIcon("thickness")}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("finalPrice")}
                >
                  <div className="flex items-center justify-end">
                    Price
                    {getSortIcon("finalPrice")}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center justify-center">
                    Status
                    {getSortIcon("status")}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSlabs.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    {searchTerm
                      ? "No slabs found matching your search."
                      : "No slabs available for this brand."}
                  </td>
                </tr>
              ) : (
                filteredSlabs.map((slab) => {
                  return (
                    <tr
                      key={slab.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {slab.series || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {slab.providerCode || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {slab.color}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {formatFinish(slab.finish)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {formatSize(slab.heightIn, slab.widthIn)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {calculateSquareFeet(slab.heightIn, slab.widthIn)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {formatThickness(slab.thickness)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(slab.finalPrice)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            slab.status === "AVAILABLE"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                              : slab.status === "DISCONTINUED"
                                ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {slab.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredSlabs.length} of {brand.slabs.length} slabs
      </div>

      {isNotesOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setIsNotesOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Brand Notes
              </h2>
              <button
                type="button"
                onClick={() => setIsNotesOpen(false)}
                className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(85vh-64px)]">
              {brand.isAdmin && !isAddNoteOpen && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setNoteError(null);
                      setIsAddNoteOpen(true);
                    }}
                    className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                  >
                    Add note
                  </button>
                </div>
              )}

              {brand.isAdmin && isAddNoteOpen && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Add Note
                  </p>
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Note title"
                    className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-sm"
                  />
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Note content"
                    rows={4}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  />
                  <input
                    type="url"
                    value={noteCatalogUrl}
                    onChange={(e) => setNoteCatalogUrl(e.target.value)}
                    placeholder="Catalogue link (optional, https://...)"
                    className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-sm"
                  />
                  {noteError ? (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {noteError}
                    </p>
                  ) : null}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddNoteOpen(false);
                        setNoteError(null);
                      }}
                      className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCreateNote()}
                      disabled={isSavingNote}
                      className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSavingNote ? "Saving..." : "Save note"}
                    </button>
                  </div>
                </div>
              )}

              {notes.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No notes added yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {notes.map((note) => {
                    const isExpanded = expandedNoteId === note.id;
                    return (
                      <div
                        key={note.id}
                        className="rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedNoteId((prev) =>
                              prev === note.id ? null : note.id,
                            )
                          }
                          className="w-full text-left px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          {note.title}
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            <p>{note.content}</p>
                            {note.catalogUrl ? (
                              <a
                                href={note.catalogUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex mt-2 items-center rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                              >
                                Open link
                              </a>
                            ) : null}
                            {brand.isAdmin ? (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteNote(note.id)}
                                  disabled={deletingNoteId === note.id}
                                  className="inline-flex items-center rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                  {deletingNoteId === note.id ? "Deleting..." : "Delete note"}
                                </button>
                              </div>
                            ) : null}
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              {new Date(note.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

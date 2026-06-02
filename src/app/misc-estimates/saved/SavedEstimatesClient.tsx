"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, FileText, Pencil, Trash2 } from "lucide-react";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";

type EstimateRow = {
  id: string;
  estimateNumber: string;
  title: string;
  customerName: string;
  customerId: string | null;
  dealName: string;
  jobId: string;
  address: string | null;
  contractor: string | null;
  date: string | null;
  salesRep: string | null;
  selectedOptions: string[];
  ledStripSubtotal: number;
  savedBy: string | null;
  createdAt: string;
};

interface Props {
  estimates: EstimateRow[];
  currentUserName: string;
}

const SECTION_LABELS: Record<string, string> = {
  LED_STRIP: "LED Strip",
  LED_SHEET: "LED Sheet",
  MIRROR: "Mirror",
  GLASS_DOOR_SHELF: "Glass Door/Shelf",
  ISLAND_PANEL: "Island Panel",
  WALL_UNIT: "Wall Unit",
  MIRROR_FRAME: "Mirror Frame",
};

const MAX_VISIBLE_SECTION_TAGS = 2;

export default function SavedEstimatesClient({
  estimates,
  currentUserName,
}: Props) {
  const [search, setSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [rows, setRows] = useState(estimates);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedSalesReps, setSelectedSalesReps] = useState<string[]>(() => {
    const me = currentUserName.trim();
    if (!me) return [];
    const hasMine = estimates.some(
      (e) => (e.salesRep ?? "").trim().toLowerCase() === me.toLowerCase(),
    );
    return hasMine ? [me] : [];
  });

  const salesRepOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row) => {
      const rep = row.salesRep?.trim();
      if (rep) set.add(rep);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const sectionOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row) => {
      row.selectedOptions.forEach((section) => {
        if (SECTION_LABELS[section]) {
          set.add(section);
        }
      });
    });

    return Array.from(set).sort((a, b) => {
      const aLabel = SECTION_LABELS[a] ?? a;
      const bLabel = SECTION_LABELS[b] ?? b;
      return aLabel.localeCompare(bLabel);
    });
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cq = clientSearch.trim().toLowerCase();
    const currentUserNameNormalized = currentUserName.trim().toLowerCase();

    return rows.filter((e) => {
      const rep = (e.salesRep ?? "").trim().toLowerCase();

      if (selectedSalesReps.length > 0) {
        const allowed = selectedSalesReps.map((v) => v.trim().toLowerCase());
        if (!allowed.includes(rep)) return false;
      }

      if (selectedSections.length > 0) {
        const hasSelectedSection = e.selectedOptions.some((section) =>
          selectedSections.includes(section),
        );
        if (!hasSelectedSection) return false;
      }

      if (cq && !e.customerName.toLowerCase().includes(cq)) {
        return false;
      }

      if (!q) return true;

      return (
        e.estimateNumber.toLowerCase().includes(q) ||
        e.customerName.toLowerCase().includes(q) ||
        e.dealName.toLowerCase().includes(q) ||
        (e.salesRep ?? "").toLowerCase().includes(q) ||
        (e.address ?? "").toLowerCase().includes(q)
      );
    });
  }, [
    rows,
    search,
    clientSearch,
    selectedSalesReps,
    selectedSections,
    currentUserName,
  ]);

  async function handleDeleteEstimate(id: string) {
    const confirmed = window.confirm(
      "Delete this saved estimate? This cannot be undone.",
    );
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const response = await fetch(
        `/api/misc-estimates?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || "Failed to delete estimate");
      }
      setRows((prev) => prev.filter((row) => row.id !== id));
    } catch (error: any) {
      window.alert(error?.message || "Failed to delete estimate");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Saved Estimates
        </h1>
        <Link
          href="/misc-estimates"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
        >
          <FileText className="w-4 h-4" />
          New Estimate
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 max-w-6xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search estimates…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="Filter by client name"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <div>
          <FilterMultiSelect
            label="Sales Person"
            options={salesRepOptions}
            selected={selectedSalesReps}
            onChange={setSelectedSalesReps}
            fullWidth
            matchInputStyle
          />
        </div>
        <div>
          <FilterMultiSelect
            label="Sections"
            options={sectionOptions.map((key) => SECTION_LABELS[key] ?? key)}
            selected={selectedSections.map((key) => SECTION_LABELS[key] ?? key)}
            onChange={(labels) => {
              const selectedKeys = Object.entries(SECTION_LABELS)
                .filter(([, label]) => labels.includes(label))
                .map(([key]) => key);
              setSelectedSections(selectedKeys);
            }}
            fullWidth
            matchInputStyle
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-10 text-center text-gray-400 text-sm">
          {estimates.length === 0
            ? "No saved estimates yet. Create one using New Estimate."
            : "No estimates match your search."}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Estimate #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Deal
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Sales Rep
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Sections
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map((est) => (
                <tr
                  key={est.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-teal-700 dark:text-teal-400">
                    <Link
                      href={`/misc-estimates?estimateId=${encodeURIComponent(est.id)}&mode=view`}
                      className="hover:underline"
                    >
                      {est.estimateNumber || "–"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 max-w-[160px] truncate">
                    {est.title}
                  </td>
                  <td className="px-4 py-3">
                    {est.customerId ? (
                      <Link
                        href={`/customers-v2/${est.customerId}`}
                        className="text-teal-700 dark:text-teal-400 hover:underline"
                      >
                        {est.customerName}
                      </Link>
                    ) : (
                      <span className="text-gray-700 dark:text-gray-300">
                        {est.customerName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[280px] truncate">
                    {est.dealName}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[280px] truncate">
                    {est.address || "–"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {est.date
                      ? new Date(est.date + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        )
                      : "–"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {est.salesRep || "–"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {est.selectedOptions
                        .slice(0, MAX_VISIBLE_SECTION_TAGS)
                        .map((key) => (
                          <span
                            key={key}
                            className="inline-block bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs rounded px-1.5 py-0.5"
                          >
                            {SECTION_LABELS[key] ?? key}
                          </span>
                        ))}
                      {est.selectedOptions.length >
                        MAX_VISIBLE_SECTION_TAGS && (
                        <span className="inline-block bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 text-xs rounded px-1.5 py-0.5">
                          +
                          {est.selectedOptions.length -
                            MAX_VISIBLE_SECTION_TAGS}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/misc-estimates?estimateId=${encodeURIComponent(est.id)}&mode=edit`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-blue-300 dark:border-blue-700 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeleteEstimate(est.id)}
                        disabled={deletingId === est.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-300 dark:border-red-700 text-xs text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-60"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deletingId === est.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
            {filtered.length} estimate{filtered.length !== 1 ? "s" : ""}
            {search ? ` matching "${search}"` : ""}
            {clientSearch ? ` for client "${clientSearch}"` : ""}
            {selectedSalesReps.length > 0
              ? ` · Sales Rep: ${selectedSalesReps.join(", ")}`
              : ""}
            {selectedSections.length > 0
              ? ` · Sections: ${selectedSections
                  .map((key) => SECTION_LABELS[key] ?? key)
                  .join(", ")}`
              : ""}
          </div>
        </div>
      )}
    </div>
  );
}

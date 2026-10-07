"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Download,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";
import {
  SLAB_FINISH_OPTIONS,
  SLAB_STATUS_OPTIONS,
  SLAB_THICKNESS_OPTIONS,
  computeListedPrice,
  computeSquareFeet,
  newRowId,
  type RowIssue,
  type SlabTemplateRow,
} from "@/lib/slabsTemplate";
import { formatCurrency } from "./types";

type RowsUpdater = (prev: SlabTemplateRow[]) => SlabTemplateRow[];

type Props = {
  rows: SlabTemplateRow[];
  onChange: (updater: RowsUpdater) => void;
  issues: Record<string, RowIssue[]>;
  onDownload: () => void;
  isDownloading: boolean;
};

const ISSUE_FILTERS = {
  errors: "Has errors",
  unverified: "Unverified price",
  unsure: "AI unsure",
  duplicates: "Duplicates",
  sizeMismatch: "Size doesn't match prices",
  clean: "No issues",
} as const;

const NO_THICKNESS = "(not set)";
const PAGE_SIZE = 200;

type BulkField = "series" | "finish" | "thickness" | "heightIn" | "widthIn" | "status";
const BULK_FIELDS: { value: BulkField; label: string }[] = [
  { value: "series", label: "Series" },
  { value: "finish", label: "Finish" },
  { value: "thickness", label: "Thickness" },
  { value: "heightIn", label: "Height (in)" },
  { value: "widthIn", label: "Width (in)" },
  { value: "status", label: "Status" },
];

// Fixed column widths (px) - applied through <colgroup> so the editable
// inputs can't squeeze each other on a wide table.
const COLS = {
  select: 34,
  index: 40,
  series: 110,
  code: 90,
  color: 190,
  finish: 140,
  size: 132,
  thickness: 84,
  sfPrice: 86,
  slabPrice: 96,
  sf: 52,
  listed: 96,
  status: 124,
  source: 104,
  issues: 190,
  remove: 36,
};

const inputCls =
  "w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

function parseNumberInput(value: string): number | null {
  if (value.trim() === "") return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export default function ReviewRows({ rows, onChange, issues, onDownload, isDownloading }: Props) {
  const [search, setSearch] = useState("");
  const [thicknessSel, setThicknessSel] = useState<string[]>([]);
  const [finishSel, setFinishSel] = useState<string[]>([]);
  const [statusSel, setStatusSel] = useState<string[]>([]);
  const [issueSel, setIssueSel] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [bulkField, setBulkField] = useState<BulkField>("thickness");
  const [bulkValue, setBulkValue] = useState("");

  const thicknessOptions = useMemo(() => {
    const present = new Set(rows.map((r) => r.thickness || NO_THICKNESS));
    return [...SLAB_THICKNESS_OPTIONS, NO_THICKNESS].filter((t) => present.has(t));
  }, [rows]);
  const finishOptions = useMemo(() => {
    const present = new Set(rows.map((r) => r.finish));
    return SLAB_FINISH_OPTIONS.filter((f) => present.has(f));
  }, [rows]);
  const statusOptions = useMemo(() => {
    const present = new Set(rows.map((r) => r.status));
    return SLAB_STATUS_OPTIONS.filter((s) => present.has(s));
  }, [rows]);

  const hasActiveFilters =
    search.trim() !== "" ||
    thicknessSel.length > 0 ||
    finishSel.length > 0 ||
    statusSel.length > 0 ||
    issueSel.length > 0;

  function clearFilters() {
    setSearch("");
    setThicknessSel([]);
    setFinishSel([]);
    setStatusSel([]);
    setIssueSel([]);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (q) {
        const hay = [row.color, row.series, row.code, row.source, row.sourceFinish]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (thicknessSel.length > 0 && !thicknessSel.includes(row.thickness || NO_THICKNESS)) return false;
      if (finishSel.length > 0 && !finishSel.includes(row.finish)) return false;
      if (statusSel.length > 0 && !statusSel.includes(row.status)) return false;
      if (issueSel.length > 0) {
        const list = issues[row.id] || [];
        const matches =
          (issueSel.includes(ISSUE_FILTERS.errors) && list.some((i) => i.level === "error")) ||
          (issueSel.includes(ISSUE_FILTERS.unverified) && list.some((i) => i.code === "price-unverified")) ||
          (issueSel.includes(ISSUE_FILTERS.unsure) && list.some((i) => i.code === "low-confidence")) ||
          (issueSel.includes(ISSUE_FILTERS.duplicates) && list.some((i) => i.code === "duplicate")) ||
          (issueSel.includes(ISSUE_FILTERS.sizeMismatch) && list.some((i) => i.code === "size-mismatch")) ||
          (issueSel.includes(ISSUE_FILTERS.clean) && list.length === 0);
        if (!matches) return false;
      }
      return true;
    });
  }, [rows, search, thicknessSel, finishSel, statusSel, issueSel, issues]);

  const visible = filtered.slice(0, visibleCount);
  const rowNumber = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r, i) => map.set(r.id, i + 1));
    return map;
  }, [rows]);

  const counts = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    for (const list of Object.values(issues)) {
      if (list.some((i) => i.level === "error")) errors++;
      else if (list.length > 0) warnings++;
    }
    return { errors, warnings };
  }, [issues]);

  /* ----------------------------- editing ----------------------------- */

  function updateRow(id: string, patch: Partial<SlabTemplateRow>) {
    onChange((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        let flags = row.flags || [];
        // Editing a value counts as checking it.
        if ("sfPrice" in patch || "slabPrice" in patch) flags = flags.filter((f) => f !== "price-unverified");
        if ("finish" in patch) flags = flags.filter((f) => f !== "finish-unrecognized");
        return { ...row, ...patch, flags };
      }),
    );
  }

  function markChecked(ids: string[]) {
    const set = new Set(ids);
    onChange((prev) => prev.map((row) => (set.has(row.id) ? { ...row, flags: [] } : row)));
  }

  function removeRows(ids: string[]) {
    const set = new Set(ids);
    onChange((prev) => prev.filter((row) => !set.has(row.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  function addRow() {
    const template = rows[0];
    const row: SlabTemplateRow = {
      id: newRowId(),
      series: template?.series ?? null,
      code: null,
      color: "",
      finish: template?.finish || "POLISHED",
      heightIn: template?.heightIn ?? null,
      widthIn: template?.widthIn ?? null,
      thickness: template?.thickness || "",
      sfPrice: null,
      slabPrice: null,
      status: "AVAILABLE",
      source: "Added manually",
      flags: [],
      note: null,
    };
    clearFilters();
    onChange((prev) => [row, ...prev]);
  }

  function applyBulk() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    let patch: Partial<SlabTemplateRow>;
    if (bulkField === "heightIn" || bulkField === "widthIn") {
      const n = parseNumberInput(bulkValue);
      if (n === null || n <= 0) return;
      patch = { [bulkField]: n };
    } else if (bulkField === "series") {
      patch = { series: bulkValue.trim() || null };
    } else {
      if (!bulkValue) return;
      patch = { [bulkField]: bulkValue };
    }
    const set = new Set(ids);
    onChange((prev) =>
      prev.map((row) => {
        if (!set.has(row.id)) return row;
        const flags =
          bulkField === "finish" ? (row.flags || []).filter((f) => f !== "finish-unrecognized") : row.flags;
        return { ...row, ...patch, flags };
      }),
    );
  }

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((r) => next.delete(r.id));
      else filtered.forEach((r) => next.add(r.id));
      return next;
    });
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const bulkSelectOptions =
    bulkField === "finish"
      ? SLAB_FINISH_OPTIONS
      : bulkField === "thickness"
        ? SLAB_THICKNESS_OPTIONS
        : bulkField === "status"
          ? SLAB_STATUS_OPTIONS
          : null;

  /* ------------------------------ render ----------------------------- */

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        {/* Search + row actions on one line */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search color, series, code or source..."
              className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Plus className="h-4 w-4" /> Add row
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={isDownloading || rows.length === 0}
              title="Download every row (not just the filtered ones) as a GMD template Excel file"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Download className="h-4 w-4" /> {isDownloading ? "Preparing..." : "Download as template"}
            </button>
          </div>
        </div>

        {/* Dropdown filters */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterMultiSelect label="Thickness" options={thicknessOptions} selected={thicknessSel} onChange={setThicknessSel} fullWidth matchInputStyle />
          <FilterMultiSelect label="Finish" options={finishOptions} selected={finishSel} onChange={setFinishSel} fullWidth matchInputStyle />
          <FilterMultiSelect label="Status" options={statusOptions} selected={statusSel} onChange={setStatusSel} fullWidth matchInputStyle />
          <FilterMultiSelect
            label="Issues"
            options={Object.values(ISSUE_FILTERS)}
            selected={issueSel}
            onChange={setIssueSel}
            fullWidth
            matchInputStyle
          />
        </div>

        {/* Showing X of Y + Clear */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Showing {filtered.length} of {rows.length}
            {counts.errors > 0 && (
              <span className="ml-2 font-medium text-red-600 dark:text-red-400">
                · {counts.errors} with errors
              </span>
            )}
            {counts.warnings > 0 && (
              <span className="ml-2 font-medium text-amber-600 dark:text-amber-400">
                · {counts.warnings} to double-check
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors ${
              hasActiveFilters
                ? "cursor-pointer border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                : "cursor-not-allowed border border-transparent text-gray-400 dark:text-gray-600"
            }`}
          >
            <X className="h-3.5 w-3.5" /> Clear Filters
          </button>
        </div>

        {/* Bulk edit bar */}
        {selected.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-sm dark:border-blue-800 dark:bg-blue-900/20">
            <span className="font-medium text-blue-900 dark:text-blue-100">{selected.size} selected</span>
            <span className="text-blue-800 dark:text-blue-200">Set</span>
            <select
              value={bulkField}
              onChange={(e) => {
                setBulkField(e.target.value as BulkField);
                setBulkValue("");
              }}
              className="h-8 rounded border border-gray-300 bg-white px-2 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              {BULK_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            {bulkSelectOptions ? (
              <select
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                className="h-8 rounded border border-gray-300 bg-white px-2 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="">-- choose --</option>
                {bulkSelectOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                type={bulkField === "series" ? "text" : "number"}
                step="0.5"
                placeholder={bulkField === "series" ? "Series name" : "Inches"}
                className="h-8 w-32 rounded border border-gray-300 bg-white px-2 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            )}
            <button
              type="button"
              onClick={applyBulk}
              className="h-8 rounded bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700"
            >
              Apply
            </button>
            <span className="mx-1 h-5 w-px bg-blue-200 dark:bg-blue-800" />
            <button
              type="button"
              onClick={() => markChecked(Array.from(selected))}
              className="inline-flex h-8 items-center gap-1 rounded border border-gray-300 bg-white px-2 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              <Check className="h-3.5 w-3.5" /> Mark checked
            </button>
            <button
              type="button"
              onClick={() => removeRows(Array.from(selected))}
              className="inline-flex h-8 items-center gap-1 rounded border border-red-300 bg-white px-2 text-xs text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-gray-800 dark:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove rows
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-auto text-xs text-blue-700 hover:underline dark:text-blue-300"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="table-fixed text-xs" style={{ minWidth: Object.values(COLS).reduce((a, b) => a + b, 0) }}>
          <colgroup>
            {Object.entries(COLS).map(([key, width]) => (
              <col key={key} style={{ width }} />
            ))}
          </colgroup>
          <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-600 dark:bg-gray-900/40 dark:text-gray-400">
            <tr>
              <th className="px-2 py-2">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all shown rows" />
              </th>
              <th className="px-1 py-2">#</th>
              <th className="px-1 py-2">Series</th>
              <th className="px-1 py-2">Code</th>
              <th className="px-1 py-2">Color</th>
              <th className="px-1 py-2">Finish</th>
              <th className="px-1 py-2">Size H × W (in)</th>
              <th className="px-1 py-2">Thick.</th>
              <th className="px-1 py-2">SF Price</th>
              <th className="px-1 py-2">Slab Price</th>
              <th className="px-1 py-2 text-right">SF</th>
              <th className="px-1 py-2 text-right">Listed</th>
              <th className="px-1 py-2">Status</th>
              <th className="px-1 py-2">Source</th>
              <th className="px-1 py-2">Issues</th>
              <th className="px-1 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {visible.length === 0 && (
              <tr>
                <td colSpan={16} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  {rows.length === 0 ? "No rows yet - use Add row to enter slabs by hand." : "No rows match these filters."}
                </td>
              </tr>
            )}
            {visible.map((row) => {
              const rowIssues = issues[row.id] || [];
              const hasError = rowIssues.some((i) => i.level === "error");
              const hasWarning = !hasError && rowIssues.length > 0;
              const sf = computeSquareFeet(row.heightIn, row.widthIn);
              const listed = computeListedPrice(row);
              return (
                <tr
                  key={row.id}
                  className={
                    hasError
                      ? "bg-red-50/70 dark:bg-red-900/10"
                      : hasWarning
                        ? "bg-amber-50/70 dark:bg-amber-900/10"
                        : ""
                  }
                >
                  <td className="px-2 py-1.5">
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} aria-label="Select row" />
                  </td>
                  <td className="px-1 py-1.5 text-gray-500 dark:text-gray-400">{rowNumber.get(row.id)}</td>
                  <td className="px-1 py-1.5">
                    <input className={inputCls} value={row.series ?? ""} onChange={(e) => updateRow(row.id, { series: e.target.value || null })} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input className={inputCls} value={row.code ?? ""} onChange={(e) => updateRow(row.id, { code: e.target.value || null })} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input
                      className={`${inputCls} font-medium`}
                      value={row.color}
                      placeholder="Color"
                      onChange={(e) => updateRow(row.id, { color: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <select
                      className={inputCls}
                      value={row.finish}
                      title={row.sourceFinish ? `In file: ${row.sourceFinish}` : undefined}
                      onChange={(e) => updateRow(row.id, { finish: e.target.value })}
                    >
                      {SLAB_FINISH_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1.5">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.5"
                        className={inputCls}
                        value={row.heightIn ?? ""}
                        aria-label="Height"
                        onChange={(e) => updateRow(row.id, { heightIn: parseNumberInput(e.target.value) })}
                      />
                      <span className="text-gray-400">×</span>
                      <input
                        type="number"
                        step="0.5"
                        className={inputCls}
                        value={row.widthIn ?? ""}
                        aria-label="Width"
                        onChange={(e) => updateRow(row.id, { widthIn: parseNumberInput(e.target.value) })}
                      />
                    </div>
                  </td>
                  <td className="px-1 py-1.5">
                    <select
                      className={inputCls}
                      value={row.thickness}
                      title={row.sourceThickness ? `In file: ${row.sourceThickness}` : undefined}
                      onChange={(e) => updateRow(row.id, { thickness: e.target.value })}
                    >
                      <option value="">--</option>
                      {SLAB_THICKNESS_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      className={inputCls}
                      value={row.sfPrice ?? ""}
                      onChange={(e) => updateRow(row.id, { sfPrice: parseNumberInput(e.target.value) })}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      className={inputCls}
                      value={row.slabPrice ?? ""}
                      onChange={(e) => updateRow(row.id, { slabPrice: parseNumberInput(e.target.value) })}
                    />
                  </td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                    {sf ? sf.toFixed(1) : "—"}
                  </td>
                  <td className="px-1 py-1.5 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                    {listed ? formatCurrency(listed) : "—"}
                  </td>
                  <td className="px-1 py-1.5">
                    <select className={inputCls} value={row.status} onChange={(e) => updateRow(row.id, { status: e.target.value })}>
                      {SLAB_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1.5 text-[11px] leading-tight text-gray-500 dark:text-gray-400">
                    {row.source || "—"}
                  </td>
                  <td className="px-1 py-1.5">
                    {rowIssues.length === 0 ? (
                      <span className="text-[11px] text-green-600 dark:text-green-400">OK</span>
                    ) : (
                      <div className="flex items-start gap-1">
                        <ul className="flex-1 space-y-0.5 text-[11px] leading-tight">
                          {rowIssues.map((issue) => (
                            <li
                              key={issue.code}
                              className={`flex items-start gap-1 ${
                                issue.level === "error"
                                  ? "text-red-700 dark:text-red-300"
                                  : "text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {issue.level === "error" ? (
                                <AlertCircle className="mt-px h-3 w-3 shrink-0" />
                              ) : (
                                <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                              )}
                              <span>{issue.message}</span>
                            </li>
                          ))}
                        </ul>
                        {!hasError && (
                          <button
                            type="button"
                            onClick={() => markChecked([row.id])}
                            title="Mark as checked"
                            className="rounded p-0.5 text-gray-500 hover:bg-gray-200 hover:text-green-700 dark:hover:bg-gray-700"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-1 py-1.5">
                    <button
                      type="button"
                      onClick={() => removeRows([row.id])}
                      title="Remove row"
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > visible.length && (
          <div className="border-t border-gray-100 p-3 text-center dark:border-gray-700">
            <button
              type="button"
              onClick={() => setVisibleCount(filtered.length)}
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Show all {filtered.length} rows ({filtered.length - visible.length} more)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

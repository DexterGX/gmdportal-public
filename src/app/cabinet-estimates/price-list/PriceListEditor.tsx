"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";
import { withCategoryIfSizeOnly } from "@/lib/cabinetItemDescription";
import {
  BUCKETS,
  BucketSelect,
  COL_W,
  EditableText,
  InstallationItemSelect,
  fixedColStyle,
  stickyColStyle,
  type CabinetSummaryBucket,
  type InstallationItemOption,
} from "../catalog-import/reviewShared";

export type PriceListEditorItem = {
  id: string;
  code: string;
  description: string;
  category: string | null;
  summaryBucket: CabinetSummaryBucket;
  installationItemId: string | null;
  isActive: boolean;
  prices: Record<string, number>;
};

type EditorTier = { key: string; id: string | null; name: string };

type EditRow = {
  rowId: string;
  id: string | null;
  code: string;
  description: string;
  category: string | null;
  summaryBucket: CabinetSummaryBucket;
  installationItemId: string | null;
  isActive: boolean;
  prices: Record<string, number | null>;
  dirty: boolean;
};

type Props = {
  vendorId: string;
  vendorName: string;
  tiers: { id: string; name: string }[];
  items: PriceListEditorItem[];
  installationItems: InstallationItemOption[];
  onSaved: (message: string) => void;
  onCancel: () => void;
  onError: (message: string) => void;
};

const SELECT_W = 40;
const TIER_W = 120;
const STATUS_W = 96;
const PAGE_SIZES = [25, 50, 100, 250];
const NO_CATEGORY = "(no category)";
const INSTALL_FILTERS = ["Unassigned", "Assigned"];
const STATUS_FILTERS = ["Active", "Discontinued"];

type BulkField = "bucket" | "installation" | "category";

const INPUT_CLASS =
  "rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

type RowProps = {
  row: EditRow;
  tiers: EditorTier[];
  installationItems: InstallationItemOption[];
  selected: boolean;
  onToggle: (rowId: string) => void;
  onPatch: (rowId: string, patch: Partial<EditRow>) => void;
  onPrice: (rowId: string, tierKey: string, price: number | null) => void;
};

// memo() + stable callbacks: typing in one cell re-renders only that row (same
// approach as the import review table, which fixed its lag).
const PriceRow = memo(function PriceRow({
  row,
  tiers,
  installationItems,
  selected,
  onToggle,
  onPatch,
  onPrice,
}: RowProps) {
  const isNew = row.id === null;
  return (
    <tr
      className={`border-t border-gray-100 dark:border-gray-700 ${
        selected ? "bg-blue-50/60 dark:bg-blue-900/10" : isNew ? "bg-green-50/60 dark:bg-green-900/10" : ""
      } ${row.isActive ? "" : "opacity-60"}`}
    >
      <td className="bg-white p-2 text-center dark:bg-gray-800" style={stickyColStyle(SELECT_W, 0)}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(row.rowId)}
          aria-label="Select row"
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
        />
      </td>
      <td className="bg-white p-2 dark:bg-gray-800" style={stickyColStyle(COL_W.code, SELECT_W)}>
        <EditableText value={row.code} onChange={(v) => onPatch(row.rowId, { code: v })} />
      </td>
      <td
        className="border-r border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800"
        style={stickyColStyle(COL_W.description, SELECT_W + COL_W.code, true)}
      >
        <EditableText value={row.description} onChange={(v) => onPatch(row.rowId, { description: v })} />
      </td>
      <td className="p-2" style={fixedColStyle(COL_W.category)}>
        <EditableText
          value={row.category || ""}
          onChange={(v) => onPatch(row.rowId, { category: v.trim() ? v : null })}
        />
      </td>
      <td className="p-2" style={fixedColStyle(COL_W.bucket)}>
        <BucketSelect value={row.summaryBucket} onChange={(v) => onPatch(row.rowId, { summaryBucket: v })} />
      </td>
      <td className="p-2" style={fixedColStyle(COL_W.installationItem)}>
        <InstallationItemSelect
          value={row.installationItemId}
          options={installationItems}
          onChange={(v) => onPatch(row.rowId, { installationItemId: v })}
        />
      </td>
      <td className="p-2 text-center" style={fixedColStyle(STATUS_W)}>
        <button
          type="button"
          onClick={() => onPatch(row.rowId, { isActive: !row.isActive })}
          title={row.isActive ? "Click to discontinue this item" : "Click to make this item active again"}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
            row.isActive
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
              : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          }`}
        >
          {row.isActive ? "Active" : "Discontinued"}
        </button>
      </td>
      {tiers.map((tier) => {
        const price = row.prices[tier.key];
        return (
          <td key={tier.key} className="p-2" style={fixedColStyle(TIER_W)}>
            <input
              type="number"
              step="0.01"
              value={price === null || price === undefined ? "" : price}
              placeholder="N/A"
              title={price === null || price === undefined ? "Not offered in this color/tier" : undefined}
              onChange={(e) => {
                const raw = e.target.value;
                onPrice(row.rowId, tier.key, raw === "" ? null : Number(raw));
              }}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-center text-xs text-gray-900 outline-none placeholder:text-gray-400 placeholder:italic dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-600"
            />
          </td>
        );
      })}
    </tr>
  );
});

export default function PriceListEditor({
  vendorId,
  vendorName,
  tiers: initialTiers,
  items,
  installationItems,
  onSaved,
  onCancel,
  onError,
}: Props) {
  const newCounter = useRef(0);

  const [tiers, setTiers] = useState<EditorTier[]>(() =>
    initialTiers.map((t) => ({ key: t.id, id: t.id, name: t.name })),
  );
  const [rows, setRows] = useState<EditRow[]>(() =>
    items.map((item) => ({
      rowId: item.id,
      id: item.id,
      code: item.code,
      description: item.description,
      category: item.category,
      summaryBucket: item.summaryBucket,
      installationItemId: item.installationItemId,
      isActive: item.isActive,
      prices: Object.fromEntries(initialTiers.map((t) => [t.id, t.id in item.prices ? item.prices[t.id] : null])),
      dirty: false,
    })),
  );
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [tiersChanged, setTiersChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  // Items named only by their size ("- 36"W X 34 1/2"H X 24"D") can get their category in front.
  const sizeOnlyCount = useMemo(
    () => rows.filter((r) => withCategoryIfSizeOnly(r.category, r.description) !== r.description).length,
    [rows],
  );
  function fixSizeOnlyDescriptions() {
    setRows((prev) =>
      prev.map((r) => {
        const next = withCategoryIfSizeOnly(r.category, r.description);
        return next === r.description ? r : { ...r, description: next, dirty: true };
      }),
    );
  }

  const dirtyCount = useMemo(() => rows.filter((r) => r.dirty || r.id === null).length, [rows]);
  const hasChanges = dirtyCount > 0 || deleteIds.length > 0 || tiersChanged;

  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  // ---- filters ----
  const [search, setSearch] = useState("");
  const [categorySel, setCategorySel] = useState<string[]>([]);
  const [bucketSel, setBucketSel] = useState<string[]>([]);
  const [installSel, setInstallSel] = useState<string[]>([]);
  const [statusSel, setStatusSel] = useState<string[]>([]);
  const filtersActive =
    search.trim() !== "" ||
    categorySel.length > 0 ||
    bucketSel.length > 0 ||
    installSel.length > 0 ||
    statusSel.length > 0;

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.category || NO_CATEGORY);
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.code} ${r.description} ${r.category || ""}`.toLowerCase().includes(q)) return false;
      if (categorySel.length > 0 && !categorySel.includes(r.category || NO_CATEGORY)) return false;
      if (bucketSel.length > 0 && !bucketSel.includes(r.summaryBucket)) return false;
      if (installSel.length > 0 && !installSel.includes(r.installationItemId ? "Assigned" : "Unassigned")) {
        return false;
      }
      if (statusSel.length > 0 && !statusSel.includes(r.isActive ? "Active" : "Discontinued")) return false;
      return true;
    });
  }, [rows, search, categorySel, bucketSel, installSel, statusSel]);

  function clearFilters() {
    setSearch("");
    setCategorySel([]);
    setBucketSel([]);
    setInstallSel([]);
    setStatusSel([]);
  }

  // ---- paging ----
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    setPage(0);
  }, [search, categorySel, bucketSel, installSel, statusSel, pageSize]);
  const safePage = Math.min(page, pageCount - 1);
  const visible = useMemo(
    () => filtered.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [filtered, safePage, pageSize],
  );

  // ---- selection ----
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleOne = useCallback((rowId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.rowId));
  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((r) => next.delete(r.rowId));
      else visible.forEach((r) => next.add(r.rowId));
      return next;
    });
  }
  const selectedCount = useMemo(() => rows.filter((r) => selected.has(r.rowId)).length, [rows, selected]);

  // ---- edits ----
  const onPatch = useCallback((rowId: string, patch: Partial<EditRow>) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch, dirty: true } : r)));
  }, []);

  const onPrice = useCallback((rowId: string, tierKey: string, price: number | null) => {
    setRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, prices: { ...r.prices, [tierKey]: price }, dirty: true } : r)),
    );
  }, []);

  function addRow() {
    newCounter.current += 1;
    const rowId = `new-row-${newCounter.current}`;
    const row: EditRow = {
      rowId,
      id: null,
      code: "",
      description: "",
      category: null,
      summaryBucket: "STANDARD",
      installationItemId: null,
      isActive: true,
      prices: Object.fromEntries(tiers.map((t) => [t.key, null])),
      dirty: true,
    };
    clearFilters();
    setRows((prev) => [row, ...prev]);
    setPage(0);
  }

  // ---- columns ----
  function addColumn() {
    const name = newColumnName.trim();
    if (!name) return;
    if (tiers.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      onError(`There is already a price column called "${name}".`);
      return;
    }
    newCounter.current += 1;
    const key = `new-tier-${newCounter.current}`;
    setTiers((prev) => [...prev, { key, id: null, name }]);
    setRows((prev) => prev.map((r) => ({ ...r, prices: { ...r.prices, [key]: null } })));
    setTiersChanged(true);
    setNewColumnName("");
  }

  function renameColumn(key: string, name: string) {
    setTiers((prev) => prev.map((t) => (t.key === key ? { ...t, name } : t)));
    setTiersChanged(true);
  }

  function removeColumn(tier: EditorTier) {
    if (
      !confirm(
        `Remove the "${tier.name}" price column? Its prices are kept in the database (the column is just hidden and can be brought back by adding a column with the same name).`,
      )
    ) {
      return;
    }
    setTiers((prev) => prev.filter((t) => t.key !== tier.key));
    setTiersChanged(true);
  }

  // ---- bulk edit ----
  const [bulkField, setBulkField] = useState<BulkField>("bucket");
  const [bulkBucket, setBulkBucket] = useState<CabinetSummaryBucket>("STANDARD");
  const [bulkInstall, setBulkInstall] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");

  function applyBulk() {
    if (selectedCount === 0) return;
    const patch: Partial<EditRow> =
      bulkField === "bucket"
        ? { summaryBucket: bulkBucket }
        : bulkField === "installation"
          ? { installationItemId: bulkInstall || null }
          : { category: bulkCategory.trim() || null };
    setRows((prev) => prev.map((r) => (selected.has(r.rowId) ? { ...r, ...patch, dirty: true } : r)));
  }

  function setSelectedActive(active: boolean) {
    setRows((prev) => prev.map((r) => (selected.has(r.rowId) ? { ...r, isActive: active, dirty: true } : r)));
  }

  function removeSelected(permanent: boolean) {
    if (selectedCount === 0) return;
    const chosen = rows.filter((r) => selected.has(r.rowId));
    const existing = chosen.filter((r) => r.id !== null);
    if (permanent && existing.length > 0) {
      if (
        !confirm(
          `Permanently delete ${existing.length} saved item${existing.length === 1 ? "" : "s"} and their prices? This can't be undone. Items used in saved estimates are skipped - discontinue those instead.`,
        )
      ) {
        return;
      }
    }
    setRows((prev) => prev.filter((r) => !selected.has(r.rowId)));
    if (permanent) {
      setDeleteIds((prev) => [...prev, ...existing.map((r) => r.id as string)]);
    }
    setSelected(new Set());
  }

  // ---- save ----
  async function save() {
    const duplicate = (() => {
      const seen = new Set<string>();
      for (const r of rows) {
        const code = r.code.trim().toLowerCase();
        if (!code) continue;
        if (seen.has(code)) return r.code.trim();
        seen.add(code);
      }
      return null;
    })();
    if (duplicate) {
      onError(`The code "${duplicate}" is used by more than one item.`);
      return;
    }
    if (rows.some((r) => (r.dirty || r.id === null) && (!r.code.trim() || !r.description.trim()))) {
      onError("Every new or edited item needs a code and a description.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/cabinet-catalog/admin/price-list", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          tiers,
          items: rows
            .filter((r) => r.dirty || r.id === null)
            .map((r) => ({
              id: r.id,
              code: r.code,
              description: r.description,
              category: r.category,
              summaryBucket: r.summaryBucket,
              installationItemId: r.installationItemId,
              isActive: r.isActive,
              prices: r.prices,
            })),
          deleteItemIds: deleteIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save the price list.");
      const parts = [
        json.created ? `${json.created} added` : "",
        json.updated ? `${json.updated} updated` : "",
        json.deleted ? `${json.deleted} deleted` : "",
        json.removedColumns ? `${json.removedColumns} column${json.removedColumns === 1 ? "" : "s"} removed` : "",
      ].filter(Boolean);
      let message = parts.length > 0 ? `Price list saved: ${parts.join(", ")}.` : "Price list saved.";
      if (Array.isArray(json.skipped) && json.skipped.length > 0) {
        message += ` Not deleted because they are used in saved estimates (discontinue them instead): ${json.skipped.join(", ")}.`;
      }
      onSaved(message);
    } catch (err: any) {
      onError(err?.message || "Failed to save the price list.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (hasChanges && !confirm("Discard your unsaved changes to this price list?")) return;
    onCancel();
  }

  const fixedColumns = 7;

  return (
    <div className="rounded-xl border border-blue-200 bg-white p-4 dark:border-blue-900 dark:bg-gray-800">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Editing {vendorName} price list
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Edit any cell, add or remove rows and price columns, then press Save. Nothing changes until you save.
            {hasChanges ? ` ${dirtyCount} row${dirtyCount === 1 ? "" : "s"} edited.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !hasChanges}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      {/* Search, then filters, then Showing X of Y + Clear, with the add buttons on the same lines */}
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, description or category..."
            className="min-w-[16rem] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
          >
            <Plus className="h-4 w-4" /> Add row
          </button>
          <button
            type="button"
            onClick={fixSizeOnlyDescriptions}
            disabled={sizeOnlyCount === 0}
            title="Puts the category in front of descriptions that only show a size, so the item can be told apart"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Add category to size-only names ({sizeOnlyCount})
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <FilterMultiSelect
            label="Category"
            options={categoryOptions}
            selected={categorySel}
            onChange={setCategorySel}
            fullWidth
            matchInputStyle
          />
          <FilterMultiSelect
            label="Bucket"
            options={BUCKETS}
            selected={bucketSel}
            onChange={setBucketSel}
            fullWidth
            matchInputStyle
          />
          <FilterMultiSelect
            label="Installation"
            options={INSTALL_FILTERS}
            selected={installSel}
            onChange={setInstallSel}
            fullWidth
            matchInputStyle
          />
          <FilterMultiSelect
            label="Status"
            options={STATUS_FILTERS}
            selected={statusSel}
            onChange={setStatusSel}
            fullWidth
            matchInputStyle
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Showing {filtered.length} of {rows.length}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addColumn();
                }
              }}
              placeholder="New price column name"
              className={`${INPUT_CLASS} w-48`}
            />
            <button
              type="button"
              onClick={addColumn}
              disabled={!newColumnName.trim()}
              className="inline-flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
            >
              <Plus className="h-3.5 w-3.5" /> Add column
            </button>
            <button
              type="button"
              onClick={clearFilters}
              disabled={!filtersActive}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                filtersActive
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
              }`}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs dark:border-blue-800 dark:bg-blue-900/20">
          <span className="font-medium text-blue-900 dark:text-blue-100">{selectedCount} selected</span>
          {selectedCount < filtered.length && (
            <button
              type="button"
              onClick={() => setSelected(new Set(filtered.map((r) => r.rowId)))}
              className="font-medium text-blue-700 underline hover:no-underline dark:text-blue-300"
            >
              Select all {filtered.length} {filtersActive ? "matching" : ""}
            </button>
          )}
          <span className="text-blue-900 dark:text-blue-100">Set</span>
          <select
            value={bulkField}
            onChange={(e) => setBulkField(e.target.value as BulkField)}
            className={INPUT_CLASS}
          >
            <option value="bucket">Bucket</option>
            <option value="installation">Installation</option>
            <option value="category">Category</option>
          </select>
          <span className="text-blue-900 dark:text-blue-100">to</span>
          {bulkField === "bucket" && (
            <select
              value={bulkBucket}
              onChange={(e) => setBulkBucket(e.target.value as CabinetSummaryBucket)}
              className={INPUT_CLASS}
            >
              {BUCKETS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
          {bulkField === "installation" && (
            <select
              value={bulkInstall}
              onChange={(e) => setBulkInstall(e.target.value)}
              className={`${INPUT_CLASS} max-w-[16rem]`}
            >
              <option value="">-- Unassigned --</option>
              {installationItems.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.description}
                </option>
              ))}
            </select>
          )}
          {bulkField === "category" && (
            <>
              <input
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                list="price-editor-categories"
                placeholder="Category (blank clears it)"
                className={`${INPUT_CLASS} w-56`}
              />
              <datalist id="price-editor-categories">
                {categoryOptions
                  .filter((c) => c !== NO_CATEGORY)
                  .map((c) => (
                    <option key={c} value={c} />
                  ))}
              </datalist>
            </>
          )}
          <button
            type="button"
            onClick={applyBulk}
            className="rounded-lg bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700"
          >
            Apply to selected
          </button>
          <button
            type="button"
            onClick={() => setSelectedActive(false)}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1 font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-gray-800 dark:text-amber-300"
          >
            Discontinue
          </button>
          <button
            type="button"
            onClick={() => setSelectedActive(true)}
            className="rounded-lg border border-green-300 bg-white px-3 py-1 font-medium text-green-700 hover:bg-green-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-300"
          >
            Make active
          </button>
          <button
            type="button"
            onClick={() => removeSelected(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1 font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-3 w-3" /> Delete permanently
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="font-medium text-gray-600 underline hover:no-underline dark:text-gray-300"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="text-left text-xs" style={{ tableLayout: "fixed", borderSpacing: 0 }}>
          <thead>
            <tr className="text-gray-500 dark:text-gray-400">
              <th className="bg-white p-2 text-center dark:bg-gray-800" style={stickyColStyle(SELECT_W, 0)}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="Select all rows on this page"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                />
              </th>
              <th className="bg-white p-2 dark:bg-gray-800" style={stickyColStyle(COL_W.code, SELECT_W)}>
                Code
              </th>
              <th
                className="border-r border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800"
                style={stickyColStyle(COL_W.description, SELECT_W + COL_W.code, true)}
              >
                Description
              </th>
              <th className="p-2" style={fixedColStyle(COL_W.category)}>
                Category
              </th>
              <th className="p-2" style={fixedColStyle(COL_W.bucket)}>
                Bucket
              </th>
              <th className="p-2" style={fixedColStyle(COL_W.installationItem)}>
                Installation
              </th>
              <th className="p-2 text-center" style={fixedColStyle(STATUS_W)}>
                Status
              </th>
              {tiers.map((tier) => (
                <th key={tier.key} className="p-2" style={fixedColStyle(TIER_W)}>
                  <div className="flex items-center gap-1">
                    <EditableText
                      value={tier.name}
                      onChange={(v) => renameColumn(tier.key, v)}
                      className="min-w-0 flex-1 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => removeColumn(tier)}
                      title={`Remove the "${tier.name}" column`}
                      className="shrink-0 text-gray-400 hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <PriceRow
                key={row.rowId}
                row={row}
                tiers={tiers}
                installationItems={installationItems}
                selected={selected.has(row.rowId)}
                onToggle={toggleOne}
                onPatch={onPatch}
                onPrice={onPrice}
              />
            ))}
            {visible.length === 0 && (
              <tr>
                <td className="p-4 text-center text-gray-400" colSpan={fixedColumns + tiers.length}>
                  {rows.length === 0 ? "No items yet - use Add row." : "No rows match the filters"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className={INPUT_CLASS}>
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              className="rounded-lg border border-gray-300 px-3 py-1 font-medium hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Previous
            </button>
            <span>
              Page {safePage + 1} of {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage >= pageCount - 1}
              className="rounded-lg border border-gray-300 px-3 py-1 font-medium hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

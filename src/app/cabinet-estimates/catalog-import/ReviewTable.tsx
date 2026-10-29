"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";
import {
  BUCKETS,
  BucketSelect,
  COL_W,
  EditableText,
  InstallationItemSelect,
  fixedColStyle,
  formatCurrency,
  stickyColStyle,
  type CabinetSummaryBucket,
  type ChangedEntry,
  type ExistingItem,
  type InstallationItemOption,
  type NormalizedItem,
} from "./reviewShared";

const SELECT_W = 40;
const PAGE_SIZES = [25, 50, 100, 250];
const NO_CATEGORY = "(no category)";
const INSTALL_FILTERS = ["Unassigned", "Needs double-check", "Assigned"];

type BulkField = "bucket" | "installation" | "category";

const INPUT_CLASS =
  "rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

type RowProps = {
  rowId: string;
  item: NormalizedItem;
  existing?: ExistingItem;
  changes?: string[];
  selected: boolean;
  tierNames: string[];
  tierColWidths: Record<string, number>;
  installationItems: InstallationItemOption[];
  onToggle: (id: string) => void;
  onPatch: (id: string, patch: Partial<NormalizedItem>) => void;
  onPrice: (id: string, tierName: string, price: number) => void;
};

// One table row. memo() + stable callbacks mean typing in one cell re-renders
// only that row instead of every row of the import (the cause of the lag).
const ReviewRow = memo(function ReviewRow({
  rowId,
  item,
  existing,
  changes,
  selected,
  tierNames,
  tierColWidths,
  installationItems,
  onToggle,
  onPatch,
  onPrice,
}: RowProps) {
  const isChanged = Boolean(existing);
  return (
    <tr
      className={`border-t border-gray-100 dark:border-gray-700 ${
        selected ? "bg-blue-50/60 dark:bg-blue-900/10" : ""
      }`}
    >
      <td
        className="bg-white p-2 text-center dark:bg-gray-800"
        style={stickyColStyle(SELECT_W, 0)}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(rowId)}
          aria-label="Select row"
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
        />
      </td>
      {isChanged ? (
        <td
          className="truncate bg-white p-2 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          style={stickyColStyle(COL_W.code, SELECT_W)}
          title={item.code}
        >
          {item.code}
        </td>
      ) : (
        <td className="bg-white p-2 dark:bg-gray-800" style={stickyColStyle(COL_W.code, SELECT_W)}>
          <EditableText value={item.code} onChange={(v) => onPatch(rowId, { code: v })} />
        </td>
      )}
      <td
        className="border-r border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800"
        style={stickyColStyle(COL_W.description, SELECT_W + COL_W.code, true)}
      >
        <EditableText
          value={item.description}
          onChange={(v) => onPatch(rowId, { description: v })}
        />
      </td>
      <td className="p-2" style={fixedColStyle(COL_W.category)}>
        <EditableText
          value={item.category || ""}
          onChange={(v) => onPatch(rowId, { category: v.trim() ? v : null })}
        />
      </td>
      <td className="p-2" style={fixedColStyle(COL_W.bucket)}>
        <BucketSelect
          value={item.summaryBucket}
          onChange={(v) => onPatch(rowId, { summaryBucket: v })}
        />
      </td>
      <td className="p-2" style={fixedColStyle(COL_W.installationItem)}>
        <InstallationItemSelect
          value={item.installationItemId}
          uncertain={item.installationItemUncertain}
          options={installationItems}
          onChange={(v) => onPatch(rowId, { installationItemId: v, installationItemUncertain: false })}
        />
      </td>
      {isChanged && (
        <td className="p-2 text-amber-700 dark:text-amber-400" style={fixedColStyle(COL_W.changedFields)}>
          {(changes || []).join(", ")}
        </td>
      )}
      {tierNames.map((tierName) => {
        const price = item.prices.find((p) => p.tierName === tierName);
        const existingPrice = existing?.prices.find((p) => p.tier.name === tierName);
        return (
          <td key={tierName} className="p-2" style={fixedColStyle(tierColWidths[tierName])}>
            <input
              type="number"
              step="0.01"
              value={price ? price.price : ""}
              placeholder="N/A"
              title={
                price
                  ? existing
                    ? existingPrice
                      ? `was ${formatCurrency(Number(existingPrice.price))}`
                      : "new tier"
                    : undefined
                  : "Not offered in this color/tier"
              }
              onChange={(e) => onPrice(rowId, tierName, Number(e.target.value) || 0)}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-center text-xs text-gray-900 outline-none placeholder:text-gray-400 placeholder:italic dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-600"
            />
          </td>
        );
      })}
    </tr>
  );
});

type Props = {
  mode: "new" | "changed";
  newItems: NormalizedItem[];
  changedItems: ChangedEntry[];
  setNewItems: Dispatch<SetStateAction<NormalizedItem[]>>;
  setChangedItems: Dispatch<SetStateAction<ChangedEntry[]>>;
  tierNames: string[];
  tierColWidths: Record<string, number>;
  tierLabel: (name: string) => string;
  onRenameTier: (tierName: string, value: string) => void;
  installationItems: InstallationItemOption[];
};

export default function ReviewTable({
  mode,
  newItems,
  changedItems,
  setNewItems,
  setChangedItems,
  tierNames,
  tierColWidths,
  tierLabel,
  onRenameTier,
  installationItems,
}: Props) {
  const isChanged = mode === "changed";

  // ---- rows (id + the original objects, so memoized rows keep their props) ----
  const rows = useMemo(
    () =>
      isChanged
        ? changedItems.map((c) => ({ id: c.existing.id, item: c.incoming, existing: c.existing, changes: c.changes }))
        : newItems.map((item) => ({ id: item.key, item, existing: undefined, changes: undefined })),
    [isChanged, newItems, changedItems],
  );

  // ---- filters ----
  const [search, setSearch] = useState("");
  const [categorySel, setCategorySel] = useState<string[]>([]);
  const [bucketSel, setBucketSel] = useState<string[]>([]);
  const [installSel, setInstallSel] = useState<string[]>([]);
  const filtersActive =
    search.trim() !== "" || categorySel.length > 0 || bucketSel.length > 0 || installSel.length > 0;

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.item.category || NO_CATEGORY);
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.item.code} ${r.item.description} ${r.item.category || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (categorySel.length > 0 && !categorySel.includes(r.item.category || NO_CATEGORY)) return false;
      if (bucketSel.length > 0 && !bucketSel.includes(r.item.summaryBucket)) return false;
      if (installSel.length > 0) {
        const state = !r.item.installationItemId
          ? "Unassigned"
          : r.item.installationItemUncertain
            ? "Needs double-check"
            : "Assigned";
        if (!installSel.includes(state)) return false;
      }
      return true;
    });
  }, [rows, search, categorySel, bucketSel, installSel]);

  function clearFilters() {
    setSearch("");
    setCategorySel([]);
    setBucketSel([]);
    setInstallSel([]);
  }

  // ---- paging ----
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    setPage(0);
  }, [search, categorySel, bucketSel, installSel, pageSize]);
  const safePage = Math.min(page, pageCount - 1);
  const visible = useMemo(
    () => filtered.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [filtered, safePage, pageSize],
  );

  // ---- selection ----
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((r) => next.delete(r.id));
      else visible.forEach((r) => next.add(r.id));
      return next;
    });
  }
  function selectAllMatching() {
    setSelected(new Set(filtered.map((r) => r.id)));
  }
  const selectedCount = useMemo(() => {
    let n = 0;
    for (const r of rows) if (selected.has(r.id)) n++;
    return n;
  }, [rows, selected]);

  // ---- edits ----
  const onPatch = useCallback(
    (id: string, patch: Partial<NormalizedItem>) => {
      if (isChanged) {
        setChangedItems((prev) =>
          prev.map((c) => (c.existing.id === id ? { ...c, incoming: { ...c.incoming, ...patch } } : c)),
        );
      } else {
        setNewItems((prev) => prev.map((i) => (i.key === id ? { ...i, ...patch } : i)));
      }
    },
    [isChanged, setChangedItems, setNewItems],
  );

  const onPrice = useCallback(
    (id: string, tierName: string, price: number) => {
      const withPrice = (item: NormalizedItem): NormalizedItem =>
        item.prices.some((p) => p.tierName === tierName)
          ? { ...item, prices: item.prices.map((p) => (p.tierName === tierName ? { ...p, price } : p)) }
          : { ...item, prices: [...item.prices, { tierName, price }] };
      if (isChanged) {
        setChangedItems((prev) =>
          prev.map((c) => (c.existing.id === id ? { ...c, incoming: withPrice(c.incoming) } : c)),
        );
      } else {
        setNewItems((prev) => prev.map((i) => (i.key === id ? withPrice(i) : i)));
      }
    },
    [isChanged, setChangedItems, setNewItems],
  );

  // ---- bulk edit ----
  const [bulkField, setBulkField] = useState<BulkField>("bucket");
  const [bulkBucket, setBulkBucket] = useState<CabinetSummaryBucket>("STANDARD");
  const [bulkInstall, setBulkInstall] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  function bulkPatch(): Partial<NormalizedItem> | null {
    if (bulkField === "bucket") return { summaryBucket: bulkBucket };
    if (bulkField === "installation") {
      return { installationItemId: bulkInstall || null, installationItemUncertain: false };
    }
    return { category: bulkCategory.trim() || null };
  }

  function applyBulk() {
    const patch = bulkPatch();
    if (!patch || selectedCount === 0) return;
    const ids = selected;
    if (isChanged) {
      setChangedItems((prev) =>
        prev.map((c) => (ids.has(c.existing.id) ? { ...c, incoming: { ...c.incoming, ...patch } } : c)),
      );
    } else {
      setNewItems((prev) => prev.map((i) => (ids.has(i.key) ? { ...i, ...patch } : i)));
    }
    setBulkMessage(`Updated ${selectedCount} row${selectedCount === 1 ? "" : "s"}.`);
  }

  function removeSelected() {
    if (selectedCount === 0) return;
    const what = isChanged
      ? "These items will keep their current catalog data (their changes are not applied)."
      : "These items will not be added to the catalog.";
    if (!confirm(`Remove ${selectedCount} row${selectedCount === 1 ? "" : "s"} from this import? ${what}`)) {
      return;
    }
    const ids = selected;
    if (isChanged) setChangedItems((prev) => prev.filter((c) => !ids.has(c.existing.id)));
    else setNewItems((prev) => prev.filter((i) => !ids.has(i.key)));
    setSelected(new Set());
    setBulkMessage(`Removed ${selectedCount} row${selectedCount === 1 ? "" : "s"} from the import.`);
  }

  const emptyText = isChanged ? "No changed items" : "No new items";
  const fixedColumns = isChanged ? 7 : 6;

  return (
    <div>
      {/* Search, then filters, then "Showing X of Y" + Clear on one line */}
      <div className="mb-3 space-y-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search code, description or category..."
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
            label="Installation item"
            options={INSTALL_FILTERS}
            selected={installSel}
            onChange={setInstallSel}
            fullWidth
            matchInputStyle
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Showing {filtered.length} of {rows.length}
          </span>
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

      {/* Bulk edit bar */}
      {selectedCount > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs dark:border-blue-800 dark:bg-blue-900/20">
          <span className="font-medium text-blue-900 dark:text-blue-100">{selectedCount} selected</span>
          {selectedCount < filtered.length && filtersActive && (
            <button
              type="button"
              onClick={selectAllMatching}
              className="font-medium text-blue-700 underline hover:no-underline dark:text-blue-300"
            >
              Select all {filtered.length} matching
            </button>
          )}
          {selectedCount < rows.length && !filtersActive && (
            <button
              type="button"
              onClick={selectAllMatching}
              className="font-medium text-blue-700 underline hover:no-underline dark:text-blue-300"
            >
              Select all {rows.length}
            </button>
          )}
          <span className="text-blue-900 dark:text-blue-100">Set</span>
          <select
            value={bulkField}
            onChange={(e) => setBulkField(e.target.value as BulkField)}
            className={INPUT_CLASS}
          >
            <option value="bucket">Bucket</option>
            <option value="installation">Installation item</option>
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
                list="review-table-categories"
                placeholder="Category (blank clears it)"
                className={`${INPUT_CLASS} w-56`}
              />
              <datalist id="review-table-categories">
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
            onClick={removeSelected}
            className="rounded-lg border border-red-300 bg-white px-3 py-1 font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-900/20"
          >
            Remove from import
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
      {bulkMessage && selectedCount === 0 && (
        <p className="mb-2 text-xs text-green-700 dark:text-green-400">{bulkMessage}</p>
      )}

      <div className="overflow-x-auto">
        <table className="text-left text-xs" style={{ tableLayout: "fixed", borderSpacing: 0 }}>
          <thead>
            <tr className="text-gray-500 dark:text-gray-400">
              <th
                className="bg-white p-2 text-center dark:bg-gray-800"
                style={stickyColStyle(SELECT_W, 0)}
              >
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
              <th className="p-2" style={fixedColStyle(COL_W.category)}>Category</th>
              <th className="p-2" style={fixedColStyle(COL_W.bucket)}>Bucket</th>
              <th className="p-2" style={fixedColStyle(COL_W.installationItem)}>Installation Item</th>
              {isChanged && (
                <th className="p-2" style={fixedColStyle(COL_W.changedFields)}>Changed fields</th>
              )}
              {tierNames.map((tierName) => (
                <th key={tierName} className="p-2" style={fixedColStyle(tierColWidths[tierName])}>
                  <EditableText
                    value={tierLabel(tierName)}
                    onChange={(v) => onRenameTier(tierName, v)}
                    className="w-full font-semibold"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <ReviewRow
                key={r.id}
                rowId={r.id}
                item={r.item}
                existing={r.existing}
                changes={r.changes}
                selected={selected.has(r.id)}
                tierNames={tierNames}
                tierColWidths={tierColWidths}
                installationItems={installationItems}
                onToggle={toggleOne}
                onPatch={onPatch}
                onPrice={onPrice}
              />
            ))}
            {visible.length === 0 && (
              <tr>
                <td
                  className="p-4 text-center text-gray-400"
                  colSpan={fixedColumns + tierNames.length}
                 
                >
                  {rows.length === 0 ? emptyText : "No rows match the filters"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paging */}
      {filtered.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className={INPUT_CLASS}
            >
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

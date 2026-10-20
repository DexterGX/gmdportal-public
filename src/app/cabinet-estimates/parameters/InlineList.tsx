"use client";

import { KeyboardEvent, useRef, useState } from "react";
import { Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Notify, Switch, cellClass, sameNumber } from "./parametersUi";

export type ListColumn = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "number" | "money" | "percent" | "multiplier" | "int";
  placeholder?: string;
  // Tailwind width classes for the column, e.g. "w-28". Columns without one
  // share the remaining space.
  className?: string;
  hint?: string;
};

type BaseRow = { id: string; isActive: boolean };

type PayloadResult = { payload: Record<string, unknown> } | { error: string };

type Props<T extends BaseRow> = {
  // Singular, lower-case: "discount", "removal type"...
  entityLabel: string;
  rows: T[];
  onRowsChange: (updater: (prev: T[]) => T[]) => void;
  columns: ListColumn[];
  collectionUrl: string;
  itemUrl: (id: string) => string;
  newDefaults?: Record<string, string>;
  buildPayload: (values: Record<string, string>, mode: "create" | "update") => PayloadResult;
  // Turns an API response into a row (e.g. Decimal strings -> numbers).
  normalizeRow?: (json: any) => T;
  rowLabel: (row: T) => string;
  sortRows?: (a: T, b: T) => number;
  allowDelete?: boolean;
  deleteWarning?: string;
  hideActive?: boolean;
  emptyText: string;
  loading?: boolean;
  notify: Notify;
};

const NUMERIC = new Set(["number", "money", "percent", "multiplier", "int"]);

function cellString(row: unknown, key: string): string {
  const v = (row as Record<string, unknown>)[key];
  return v === null || v === undefined ? "" : String(v);
}

function sameValue(kind: ListColumn["kind"], a: string, b: string): boolean {
  return NUMERIC.has(kind) ? sameNumber(a, b) : a.trim() === b.trim();
}

const ADORNMENT: Partial<Record<ListColumn["kind"], { before?: string; after?: string }>> = {
  money: { before: "$" },
  percent: { after: "%" },
  multiplier: { after: "x" },
};

/**
 * A small table where every row is editable in place and the "add" row sits
 * at the top: type, press Enter, done. Rows with unsaved edits get a tint plus
 * Save / Undo buttons; the on/off switch saves immediately.
 */
export default function InlineList<T extends BaseRow>({
  entityLabel,
  rows,
  onRowsChange,
  columns,
  collectionUrl,
  itemUrl,
  newDefaults,
  buildPayload,
  normalizeRow,
  rowLabel,
  sortRows,
  allowDelete = true,
  deleteWarning,
  hideActive,
  emptyText,
  loading,
  notify,
}: Props<T>) {
  const blankNew = () => {
    const out: Record<string, string> = {};
    for (const c of columns) out[c.key] = newDefaults?.[c.key] ?? "";
    return out;
  };

  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [newVals, setNewVals] = useState<Record<string, string>>(blankNew);
  const [busy, setBusy] = useState<string | null>(null);
  const firstAddInput = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const shown = sortRows ? [...rows].sort(sortRows) : rows;

  function baseValues(row: T): Record<string, string> {
    const out: Record<string, string> = {};
    for (const c of columns) out[c.key] = cellString(row, c.key);
    return out;
  }

  function currentValues(row: T): Record<string, string> {
    return { ...baseValues(row), ...(drafts[row.id] || {}) };
  }

  function isDirty(row: T): boolean {
    const draft = drafts[row.id];
    if (!draft) return false;
    const base = baseValues(row);
    return columns.some((c) => c.key in draft && !sameValue(c.kind, draft[c.key], base[c.key]));
  }

  function setCell(row: T, key: string, value: string) {
    setDrafts((prev) => ({ ...prev, [row.id]: { ...(prev[row.id] || {}), [key]: value } }));
  }

  function undoRow(row: T) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
  }

  async function request(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "Something went wrong");
    return json;
  }

  const toRow = (json: any): T => (normalizeRow ? normalizeRow(json) : (json as T));

  async function saveRow(row: T) {
    const built = buildPayload(currentValues(row), "update");
    if ("error" in built) {
      notify("error", built.error);
      return;
    }
    setBusy(row.id);
    try {
      const json = await request(itemUrl(row.id), "PATCH", built.payload);
      const updated = toRow(json);
      onRowsChange((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      undoRow(row);
      notify("success", `Saved "${rowLabel(updated)}".`);
    } catch (err: any) {
      notify("error", err?.message || `Failed to save ${entityLabel}`);
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(row: T) {
    setBusy(row.id);
    try {
      const json = await request(itemUrl(row.id), "PATCH", { isActive: !row.isActive });
      const updated = toRow(json);
      onRowsChange((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: updated.isActive } : r)));
      notify("success", `"${rowLabel(row)}" is now ${updated.isActive ? "active" : "inactive"}.`);
    } catch (err: any) {
      notify("error", err?.message || `Failed to update ${entityLabel}`);
    } finally {
      setBusy(null);
    }
  }

  async function deleteRow(row: T) {
    const ok = window.confirm(
      `Permanently delete "${rowLabel(row)}"?\n\n${
        deleteWarning ?? "This can't be undone."
      }\n\nTo keep its history, switch it off (inactive) instead.`,
    );
    if (!ok) return;
    setBusy(row.id);
    try {
      await request(itemUrl(row.id), "DELETE");
      onRowsChange((prev) => prev.filter((r) => r.id !== row.id));
      undoRow(row);
      notify("success", `Deleted "${rowLabel(row)}".`);
    } catch (err: any) {
      notify("error", err?.message || `Failed to delete ${entityLabel}`);
    } finally {
      setBusy(null);
    }
  }

  async function createRow() {
    const built = buildPayload(newVals, "create");
    if ("error" in built) {
      notify("error", built.error);
      return;
    }
    setBusy("new");
    try {
      const json = await request(collectionUrl, "POST", { ...built.payload, isActive: true });
      const created = toRow(json);
      onRowsChange((prev) => [...prev, created]);
      setNewVals(blankNew());
      notify("success", `Added "${rowLabel(created)}".`);
      firstAddInput.current?.focus();
    } catch (err: any) {
      notify("error", err?.message || `Failed to add ${entityLabel}`);
    } finally {
      setBusy(null);
    }
  }

  function onRowKey(e: KeyboardEvent, row: T) {
    if (e.key === "Enter" && !(e.shiftKey && (e.target as HTMLElement).tagName === "TEXTAREA")) {
      e.preventDefault();
      if (isDirty(row) && busy === null) void saveRow(row);
    } else if (e.key === "Escape") {
      undoRow(row);
    }
  }

  function renderInput(
    col: ListColumn,
    value: string,
    onChange: (v: string) => void,
    onKeyDown: (e: KeyboardEvent) => void,
    opts?: { placeholder?: string; first?: boolean },
  ) {
    const adorn = ADORNMENT[col.kind];
    const common = {
      value,
      onKeyDown,
      placeholder: opts?.placeholder ?? col.placeholder,
      "aria-label": col.label,
    };
    if (col.kind === "textarea") {
      return (
        <textarea
          {...common}
          rows={2}
          ref={opts?.first ? (el) => { firstAddInput.current = el; } : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`${cellClass} resize-y`}
        />
      );
    }
    const numeric = NUMERIC.has(col.kind);
    const input = (
      <input
        {...common}
        type="text"
        inputMode={numeric ? "decimal" : undefined}
        ref={opts?.first ? (el) => { firstAddInput.current = el; } : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`${cellClass} ${numeric ? "text-right" : ""}`}
      />
    );
    if (!adorn) return input;
    return (
      <div className="flex items-center gap-1">
        {adorn.before && <span className="text-sm text-gray-400">{adorn.before}</span>}
        {input}
        {adorn.after && <span className="text-sm text-gray-400">{adorn.after}</span>}
      </div>
    );
  }

  const colSpan = columns.length + (hideActive ? 1 : 2);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2 text-left font-medium ${c.className || ""} ${
                  NUMERIC.has(c.kind) ? "text-right" : ""
                }`}
                title={c.hint}
              >
                {c.label}
              </th>
            ))}
            {!hideActive && <th className="w-16 px-3 py-2 text-center font-medium">Active</th>}
            <th className="w-28 px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {/* Add row: always on top so a new entry never means scrolling or opening a form */}
          <tr className="bg-teal-50/60 dark:bg-teal-950/20">
            {columns.map((c, i) => (
              <td key={c.key} className="px-2 py-1.5 align-top">
                {renderInput(
                  c,
                  newVals[c.key] ?? "",
                  (v) => setNewVals((prev) => ({ ...prev, [c.key]: v })),
                  (e) => {
                    if (e.key === "Enter" && !(e.shiftKey && (e.target as HTMLElement).tagName === "TEXTAREA")) {
                      e.preventDefault();
                      if (busy === null) void createRow();
                    }
                  },
                  { placeholder: i === 0 ? `New ${entityLabel}...` : c.placeholder, first: i === 0 },
                )}
              </td>
            ))}
            {!hideActive && <td className="px-3 py-1.5 text-center text-xs text-gray-400">on</td>}
            <td className="px-2 py-1.5 text-right align-top">
              <button
                type="button"
                onClick={() => void createRow()}
                disabled={busy !== null}
                className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </td>
          </tr>

          {loading &&
            [0, 1, 2].map((i) => (
              <tr key={`sk-${i}`}>
                <td colSpan={colSpan} className="px-3 py-3">
                  <div className="h-4 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                </td>
              </tr>
            ))}

          {!loading && shown.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="px-3 py-6 text-center text-sm text-gray-400">
                {emptyText}
              </td>
            </tr>
          )}

          {shown.map((row) => {
            const values = currentValues(row);
            const dirty = isDirty(row);
            const rowBusy = busy === row.id;
            return (
              <tr
                key={row.id}
                className={`${dirty ? "bg-amber-50/70 dark:bg-amber-900/10" : ""} ${
                  row.isActive ? "" : "opacity-60"
                }`}
              >
                {columns.map((c) => (
                  <td key={c.key} className="px-2 py-1.5 align-top">
                    {renderInput(c, values[c.key] ?? "", (v) => setCell(row, c.key, v), (e) =>
                      onRowKey(e, row),
                    )}
                  </td>
                ))}
                {!hideActive && (
                  <td className="px-3 py-1.5 text-center align-top">
                    <div className="flex h-8 items-center justify-center">
                      <Switch
                        checked={row.isActive}
                        onChange={() => void toggleActive(row)}
                        disabled={busy !== null}
                        label={row.isActive ? "Active - click to deactivate" : "Inactive - click to activate"}
                      />
                    </div>
                  </td>
                )}
                <td className="px-2 py-1.5 text-right align-top">
                  <div className="flex h-8 items-center justify-end gap-1">
                    {dirty ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void saveRow(row)}
                          disabled={busy !== null}
                          className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                          title="Save changes (Enter)"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {rowBusy ? "Saving" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => undoRow(row)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                          title="Undo changes (Esc)"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      allowDelete && (
                        <button
                          type="button"
                          onClick={() => void deleteRow(row)}
                          disabled={busy !== null}
                          className="rounded-md p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30"
                          title={`Delete permanently (switch off instead to keep history)`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

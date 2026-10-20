"use client";

import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardPaste, Plus, RotateCcw, Save, Search, Trash2, Users, X } from "lucide-react";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";
import InstallersManager, { InstallerRow } from "./InstallersManager";
import PasteImportModal, { PastedItem } from "./PasteImportModal";
import {
  Notify,
  SectionCard,
  Switch,
  cellClass,
  fieldClass,
  parseNumber,
  primaryButton,
  sameNumber,
  secondaryButton,
} from "./parametersUi";

type Bucket = "STANDARD" | "DOUBLE" | "CUSTOM" | "MISC";

type ItemRow = {
  id: string;
  code: string | null;
  description: string;
  salePrice: number;
  isActive: boolean;
  sortOrder: number;
  bucketDefault: Bucket | null;
};

type ItemDraft = {
  code?: string;
  description?: string;
  salePrice?: string;
  bucketDefault?: string;
  isActive?: boolean;
};

type NewRow = {
  key: string;
  code: string;
  description: string;
  salePrice: string;
  bucketDefault: string;
  isActive: boolean;
  costs: Record<string, string>;
};

const BUCKET_LABELS: Record<Bucket, string> = {
  STANDARD: "Standard",
  DOUBLE: "Double",
  CUSTOM: "Custom",
  MISC: "Misc",
};

const BUCKET_FILTER_OPTIONS = ["Standard", "Double", "Custom", "Misc", "None"];

const costKey = (installerId: string, itemId: string) => `${installerId}:${itemId}`;

let newRowCounter = 0;
const nextRowKey = () => `new-${Date.now()}-${newRowCounter++}`;

// Everything one grid row needs to render, whether it is saved or brand new.
type RowView = {
  key: string;
  nav: number;
  isNew: boolean;
  code: string;
  description: string;
  salePrice: string;
  bucket: string;
  isActive: boolean;
  dirty: boolean;
  hasError: boolean;
  cost: (installerId: string) => string;
  costDirty: (installerId: string) => boolean;
  fieldDirty: (field: "code" | "description" | "salePrice" | "bucketDefault" | "isActive") => boolean;
};

export default function PriceTableSection({ notify }: { notify: Notify }) {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [installers, setInstallers] = useState<InstallerRow[]>([]);
  const [costsServer, setCostsServer] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({});
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>({});
  const [newRows, setNewRows] = useState<NewRow[]>([]);
  const [errorKeys, setErrorKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [bucketFilter, setBucketFilter] = useState<string[]>([]);

  const [showPaste, setShowPaste] = useState(false);
  const [showInstallers, setShowInstallers] = useState(false);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const pendingFocus = useRef<{ row: number; col: string } | null>(null);

  const activeInstallers = useMemo(() => installers.filter((i) => i.isActive), [installers]);

  /* ------------------------------- loading ------------------------------ */

  const load = useCallback(async (initial: boolean) => {
    if (initial) setLoading(true);
    try {
      const [itemsRes, installersRes, costsRes] = await Promise.all([
        fetch("/api/cabinet-estimates/parameters/installation-items"),
        fetch("/api/cabinet-estimates/parameters/installers"),
        fetch("/api/cabinet-estimates/parameters/installer-costs"),
      ]);
      const [itemsJson, installersJson, costsJson] = await Promise.all([
        itemsRes.json().catch(() => ({})),
        installersRes.json().catch(() => ({})),
        costsRes.json().catch(() => ({})),
      ]);
      if (!itemsRes.ok || !installersRes.ok || !costsRes.ok) {
        throw new Error(
          itemsJson?.error || installersJson?.error || costsJson?.error || "Failed to load the price table",
        );
      }
      setItems(itemsJson.installationItems || []);
      setInstallers(installersJson.installers || []);
      const map: Record<string, number> = {};
      for (const row of costsJson.costs || []) map[costKey(row.installerId, row.itemId)] = row.cost;
      setCostsServer(map);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load the price table");
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  /* ------------------------------ row values ----------------------------- */

  function fieldIsDirty(item: ItemRow, field: keyof ItemDraft): boolean {
    const draft = drafts[item.id];
    if (!draft || draft[field] === undefined) return false;
    if (field === "salePrice") return !sameNumber(draft.salePrice, item.salePrice);
    if (field === "isActive") return draft.isActive !== item.isActive;
    if (field === "description") return (draft.description ?? "").trim() !== item.description;
    if (field === "code") return (draft.code ?? "").trim() !== (item.code ?? "");
    return (draft.bucketDefault ?? "") !== (item.bucketDefault ?? "");
  }

  function costIsDirty(installerId: string, itemId: string): boolean {
    const key = costKey(installerId, itemId);
    const draft = costDrafts[key];
    if (draft === undefined) return false;
    const server = costsServer[key];
    if (server === undefined) return draft.trim() !== "";
    return !sameNumber(draft, server);
  }

  const itemDirty = (item: ItemRow) =>
    (["code", "description", "salePrice", "bucketDefault", "isActive"] as (keyof ItemDraft)[]).some((f) =>
      fieldIsDirty(item, f),
    );

  const rowHasContent = (r: NewRow) =>
    r.description.trim() !== "" ||
    parseNumber(r.salePrice) > 0 ||
    r.bucketDefault !== "" ||
    Object.values(r.costs).some((c) => c.trim() !== "");

  function setItemField(item: ItemRow, field: keyof ItemDraft, value: string | boolean) {
    setDrafts((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] || {}), [field]: value } }));
    setErrorKeys((prev) => {
      if (!prev.has(item.id)) return prev;
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  }

  function setNewField(key: string, patch: Partial<NewRow>) {
    setNewRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setErrorKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function setNewCost(key: string, installerId: string, value: string) {
    setNewRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, costs: { ...r.costs, [installerId]: value } } : r)),
    );
  }

  function setCost(installerId: string, itemId: string, value: string) {
    setCostDrafts((prev) => ({ ...prev, [costKey(installerId, itemId)]: value }));
  }

  function undoItem(item: ItemRow) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    setCostDrafts((prev) => {
      const next = { ...prev };
      for (const i of installers) delete next[costKey(i.id, item.id)];
      return next;
    });
    setErrorKeys((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  }

  /* ---------------------------- auto code numbers -------------------------- */

  function nextCodeNumber(extraCodes: string[] = []): number {
    let max = 0;
    const all = [
      ...items.map((i) => i.code ?? ""),
      ...Object.values(drafts).map((d) => d.code ?? ""),
      ...newRows.map((r) => r.code),
      ...extraCodes,
    ];
    for (const code of all) {
      if (/^\d+$/.test(code.trim())) max = Math.max(max, parseInt(code.trim(), 10));
    }
    return max + 1;
  }

  /* ------------------------------- add rows ------------------------------- */

  function addBlankRow(focusCol = "description") {
    const row: NewRow = {
      key: nextRowKey(),
      code: String(nextCodeNumber()),
      description: "",
      salePrice: "",
      bucketDefault: "",
      isActive: true,
      costs: {},
    };
    pendingFocus.current = { row: visibleItems.length + newRows.length, col: focusCol };
    setNewRows((prev) => [...prev, row]);
  }

  function addPasted(pasted: PastedItem[]) {
    let counter = nextCodeNumber();
    const rows: NewRow[] = pasted.map((p) => {
      const code = p.code.trim() || String(counter++);
      if (p.code.trim() && /^\d+$/.test(p.code.trim())) counter = Math.max(counter, parseInt(p.code.trim(), 10) + 1);
      return {
        key: nextRowKey(),
        code,
        description: p.description,
        salePrice: p.salePrice,
        bucketDefault: p.bucketDefault,
        isActive: true,
        costs: p.costs,
      };
    });
    setNewRows((prev) => [...prev, ...rows]);
    setShowPaste(false);
    notify("success", `${rows.length} row${rows.length === 1 ? "" : "s"} added - press Save all to keep them.`);
  }

  /* -------------------------------- filters -------------------------------- */

  const filtersActive = query.trim() !== "" || statusFilter.length > 0 || bucketFilter.length > 0;

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (q && !`${item.code ?? ""} ${item.description}`.toLowerCase().includes(q)) return false;
      if (statusFilter.length > 0) {
        const label = item.isActive ? "Active" : "Inactive";
        if (!statusFilter.includes(label)) return false;
      }
      if (bucketFilter.length > 0) {
        const label = item.bucketDefault ? BUCKET_LABELS[item.bucketDefault] : "None";
        if (!bucketFilter.includes(label)) return false;
      }
      return true;
    });
  }, [items, query, statusFilter, bucketFilter]);

  function clearFilters() {
    setQuery("");
    setStatusFilter([]);
    setBucketFilter([]);
  }

  /* --------------------------------- rows ---------------------------------- */

  const rowViews: RowView[] = [
    ...visibleItems.map((item, index): RowView => {
      const draft = drafts[item.id] || {};
      return {
        key: item.id,
        nav: index,
        isNew: false,
        code: draft.code ?? item.code ?? "",
        description: draft.description ?? item.description,
        salePrice: draft.salePrice ?? String(item.salePrice),
        bucket: draft.bucketDefault ?? item.bucketDefault ?? "",
        isActive: draft.isActive ?? item.isActive,
        dirty:
          itemDirty(item) || installers.some((i) => costIsDirty(i.id, item.id)),
        hasError: errorKeys.has(item.id),
        cost: (installerId) => {
          const key = costKey(installerId, item.id);
          if (costDrafts[key] !== undefined) return costDrafts[key];
          return costsServer[key] === undefined ? "" : String(costsServer[key]);
        },
        costDirty: (installerId) => costIsDirty(installerId, item.id),
        fieldDirty: (field) => fieldIsDirty(item, field),
      };
    }),
    ...newRows.map((r, index): RowView => ({
      key: r.key,
      nav: visibleItems.length + index,
      isNew: true,
      code: r.code,
      description: r.description,
      salePrice: r.salePrice,
      bucket: r.bucketDefault,
      isActive: r.isActive,
      dirty: true,
      hasError: errorKeys.has(r.key),
      cost: (installerId) => r.costs[installerId] ?? "",
      costDirty: () => false,
      fieldDirty: () => false,
    })),
  ];

  const dirtyExisting = items.filter(
    (item) => itemDirty(item) || installers.some((i) => costIsDirty(i.id, item.id)),
  );
  const pendingNew = newRows.filter(rowHasContent);
  const dirtyCount = dirtyExisting.length + pendingNew.length;

  /* ----------------------------- keyboard nav ------------------------------ */

  function focusCell(row: number, col: string): boolean {
    const el = gridRef.current?.querySelector<HTMLElement>(
      `[data-nav-row="${row}"][data-nav-col="${col}"]`,
    );
    if (!el) return false;
    el.focus();
    if (el instanceof HTMLInputElement) el.select();
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    return true;
  }

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    focusCell(pending.row, pending.col);
  });

  function onCellKey(e: KeyboardEvent, view: RowView, col: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!focusCell(view.nav + 1, col) && view.isNew) {
        addBlankRow(col);
      }
    } else if (e.key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      focusCell(view.nav + 1, col);
    } else if (e.key === "ArrowUp" && e.altKey) {
      e.preventDefault();
      focusCell(view.nav - 1, col);
    }
  }

  /* --------------------------------- saving -------------------------------- */

  async function api(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "Something went wrong");
    return json;
  }

  async function saveAll() {
    if (saving || dirtyCount === 0) return;
    const problems: string[] = [];
    const badKeys = new Set<string>();

    // Resulting state of every row, to check codes and bucket defaults.
    type Final = { key: string; code: string; bucket: string; label: string; changed: boolean };
    const finals: Final[] = [];
    for (const item of items) {
      const d = drafts[item.id] || {};
      const changed = itemDirty(item);
      const description = (d.description ?? item.description).trim();
      if (changed && !description) {
        problems.push("A row has no description.");
        badKeys.add(item.id);
      }
      finals.push({
        key: item.id,
        code: (d.code ?? item.code ?? "").trim(),
        bucket: d.bucketDefault ?? item.bucketDefault ?? "",
        label: description || item.description,
        changed: fieldIsDirty(item, "bucketDefault"),
      });
    }
    pendingNew.forEach((r, i) => {
      if (!r.description.trim()) {
        problems.push(`New row ${i + 1} needs a description.`);
        badKeys.add(r.key);
      }
      finals.push({
        key: r.key,
        code: r.code.trim(),
        bucket: r.bucketDefault,
        label: r.description.trim() || `New row ${i + 1}`,
        changed: r.bucketDefault !== "",
      });
    });

    const seenCodes = new Map<string, string>();
    for (const f of finals) {
      if (!f.code) continue;
      const lower = f.code.toLowerCase();
      const other = seenCodes.get(lower);
      if (other) {
        problems.push(`Code ${f.code} is used by more than one row.`);
        badKeys.add(f.key);
        badKeys.add(other);
      } else seenCodes.set(lower, f.key);
    }

    const takeovers: string[] = [];
    const byBucket = new Map<string, Final[]>();
    for (const f of finals) {
      if (!f.bucket) continue;
      byBucket.set(f.bucket, [...(byBucket.get(f.bucket) || []), f]);
    }
    byBucket.forEach((holders, bucket) => {
      if (holders.length < 2) return;
      const changed = holders.filter((h) => h.changed);
      if (changed.length > 1) {
        problems.push(`Only one item can be the default for ${BUCKET_LABELS[bucket as Bucket]}.`);
        changed.forEach((h) => badKeys.add(h.key));
      } else if (changed.length === 1) {
        const others = holders.filter((h) => !h.changed).map((h) => h.label);
        takeovers.push(`${BUCKET_LABELS[bucket as Bucket]} moves from "${others.join(", ")}" to "${changed[0].label}"`);
      }
    });

    if (problems.length > 0) {
      setErrorKeys(badKeys);
      notify("error", problems[0]);
      return;
    }
    if (takeovers.length > 0) {
      const ok = window.confirm(
        `Only one item can be the automatic default for a bucket:\n\n${takeovers.join("\n")}\n\nContinue?`,
      );
      if (!ok) return;
    }

    setSaving(true);
    setErrorKeys(new Set());
    const failures: string[] = [];
    const failedKeys = new Set<string>();
    const createdIds = new Map<string, string>();
    const savedNewKeys = new Set<string>();
    const savedItemIds = new Set<string>();

    for (const r of pendingNew) {
      try {
        const created = await api("/api/cabinet-estimates/parameters/installation-items", "POST", {
          code: r.code.trim() || null,
          description: r.description.trim(),
          salePrice: parseNumber(r.salePrice),
          isActive: r.isActive,
          bucketDefault: r.bucketDefault || null,
        });
        createdIds.set(r.key, created.id);
        savedNewKeys.add(r.key);
      } catch (err: any) {
        failures.push(`${r.description.trim()}: ${err?.message || "failed"}`);
        failedKeys.add(r.key);
      }
    }

    for (const item of dirtyExisting) {
      if (!itemDirty(item)) {
        savedItemIds.add(item.id); // only cost cells changed - handled below
        continue;
      }
      const d = drafts[item.id] || {};
      try {
        await api(`/api/cabinet-estimates/parameters/installation-items/${item.id}`, "PATCH", {
          code: (d.code ?? item.code ?? "").trim() || null,
          description: (d.description ?? item.description).trim(),
          salePrice: parseNumber(d.salePrice ?? item.salePrice),
          isActive: d.isActive ?? item.isActive,
          bucketDefault: (d.bucketDefault ?? item.bucketDefault ?? "") || null,
        });
        savedItemIds.add(item.id);
      } catch (err: any) {
        failures.push(`${d.description ?? item.description}: ${err?.message || "failed"}`);
        failedKeys.add(item.id);
      }
    }

    const costPayload: { installerId: string; itemId: string; cost: number }[] = [];
    const savedCostKeys: string[] = [];
    for (const item of dirtyExisting) {
      if (failedKeys.has(item.id)) continue;
      for (const inst of installers) {
        if (!costIsDirty(inst.id, item.id)) continue;
        const key = costKey(inst.id, item.id);
        costPayload.push({ installerId: inst.id, itemId: item.id, cost: parseNumber(costDrafts[key]) });
        savedCostKeys.push(key);
      }
    }
    for (const r of pendingNew) {
      const id = createdIds.get(r.key);
      if (!id) continue;
      for (const [installerId, value] of Object.entries(r.costs)) {
        if (value.trim() === "") continue;
        costPayload.push({ installerId, itemId: id, cost: parseNumber(value) });
      }
    }
    let costsSaved = true;
    if (costPayload.length > 0) {
      try {
        await api("/api/cabinet-estimates/parameters/installer-costs", "PATCH", { costs: costPayload });
      } catch (err: any) {
        costsSaved = false;
        failures.push(`Installer costs: ${err?.message || "failed"}`);
      }
    }

    setNewRows((prev) => prev.filter((r) => !savedNewKeys.has(r.key)));
    setDrafts((prev) => {
      const next = { ...prev };
      savedItemIds.forEach((id) => delete next[id]);
      return next;
    });
    if (costsSaved) {
      setCostDrafts((prev) => {
        const next = { ...prev };
        savedCostKeys.forEach((k) => delete next[k]);
        return next;
      });
    }
    setErrorKeys(failedKeys);
    await load(false);
    setSaving(false);

    if (failures.length === 0) {
      notify("success", `Saved ${dirtyCount} change${dirtyCount === 1 ? "" : "s"}.`);
    } else {
      notify(
        "error",
        `${failures.length} change${failures.length === 1 ? "" : "s"} could not be saved - ${failures[0]}`,
      );
    }
  }

  function discardAll() {
    if (
      dirtyCount > 0 &&
      !window.confirm(`Discard ${dirtyCount} unsaved change${dirtyCount === 1 ? "" : "s"}?`)
    ) {
      return;
    }
    setDrafts({});
    setCostDrafts({});
    setNewRows([]);
    setErrorKeys(new Set());
  }

  async function deleteItem(item: ItemRow) {
    const ok = window.confirm(
      `Permanently delete "${item.description}"?\n\nIf it is used on a saved estimate or assigned to catalog items it cannot be deleted - switch it off (inactive) instead, which keeps its history.`,
    );
    if (!ok) return;
    try {
      await api(`/api/cabinet-estimates/parameters/installation-items/${item.id}`, "DELETE");
      undoItem(item);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      notify("success", `Deleted "${item.description}".`);
    } catch (err: any) {
      notify("error", err?.message || "Failed to delete");
    }
  }

  // Warn before leaving the page with unsaved edits; Ctrl/Cmd+S saves.
  useEffect(() => {
    if (dirtyCount === 0) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveAll();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", onKey);
    };
    // saveAll reads the latest state through closure on each render; re-binding
    // on every render keeps Ctrl+S saving what is currently on screen.
  });

  /* --------------------------------- render -------------------------------- */

  const navProps = (view: RowView, col: string) => ({
    "data-nav-row": view.nav,
    "data-nav-col": col,
    onKeyDown: (e: KeyboardEvent) => onCellKey(e, view, col),
  });

  const dirtyCell = (dirty: boolean) => (dirty ? "bg-amber-100/70 dark:bg-amber-900/20" : "");
  const minWidth = 700 + activeInstallers.length * 130;
  const totalCols = 6 + activeInstallers.length;

  return (
    <SectionCard
      title="Installers Price Table"
      description={
        <>
          The item-by-item list that catalog cabinets get assigned to for installation pricing. The
          <strong> Sale price</strong> feeds the customer estimate; the installer cost columns are
          internal bookkeeping only and never affect an estimate.
        </>
      }
    >
      {loadError ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {loadError}
          <button type="button" onClick={() => void load(true)} className={secondaryButton}>
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* line 1: search + actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by code or description..."
                className={`${fieldClass} pl-9`}
                aria-label="Search items"
              />
            </div>
            <button type="button" onClick={() => addBlankRow()} className={primaryButton}>
              <Plus className="h-4 w-4" />
              Add row
            </button>
            <button type="button" onClick={() => setShowPaste(true)} className={secondaryButton}>
              <ClipboardPaste className="h-4 w-4" />
              Paste from Excel
            </button>
            <button type="button" onClick={() => setShowInstallers(true)} className={secondaryButton}>
              <Users className="h-4 w-4" />
              Installers ({activeInstallers.length})
            </button>
          </div>

          {/* line 2: filters + count + clear */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterMultiSelect
              label="Status"
              options={["Active", "Inactive"]}
              selected={statusFilter}
              onChange={setStatusFilter}
            />
            <FilterMultiSelect
              label="Bucket default"
              options={BUCKET_FILTER_OPTIONS}
              selected={bucketFilter}
              onChange={setBucketFilter}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing {visibleItems.length} of {items.length}
            </span>
            <button
              type="button"
              onClick={clearFilters}
              disabled={!filtersActive}
              className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm transition ${
                filtersActive
                  ? "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                  : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500"
              }`}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
            <span className="ml-auto hidden text-xs text-gray-400 lg:inline">
              Enter moves to the next row &middot; nothing is saved until you press Save all (Ctrl+S)
            </span>
          </div>

          <div ref={gridRef} className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm" style={{ minWidth }}>
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                <tr>
                  <th className="sticky left-0 z-10 w-20 min-w-[5rem] max-w-[5rem] bg-gray-50 px-3 py-2 text-left font-medium dark:bg-gray-900">
                    Code
                  </th>
                  <th className="sticky left-20 z-10 min-w-[240px] bg-gray-50 px-3 py-2 text-left font-medium dark:bg-gray-900">
                    Description
                  </th>
                  <th className="w-32 px-3 py-2 text-right font-medium">Sale price</th>
                  <th className="w-36 px-3 py-2 text-left font-medium" title="Every catalog cabinet in this bucket is assigned to this item automatically - no AI guessing.">
                    Bucket default
                  </th>
                  <th className="w-16 px-3 py-2 text-center font-medium">Active</th>
                  {activeInstallers.map((inst) => (
                    <th key={inst.id} className="w-32 px-3 py-2 text-right font-medium" title={`Cost for ${inst.name} (internal)`}>
                      <span className="block truncate">{inst.name}</span>
                      <span className="block text-[10px] font-normal normal-case text-gray-400">cost</span>
                    </th>
                  ))}
                  <th className="w-24 px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading &&
                  [0, 1, 2, 3, 4].map((i) => (
                    <tr key={`sk-${i}`}>
                      <td colSpan={totalCols} className="px-3 py-3">
                        <div className="h-4 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
                      </td>
                    </tr>
                  ))}

                {!loading && rowViews.length === 0 && (
                  <tr>
                    <td colSpan={totalCols} className="px-3 py-10 text-center">
                      {items.length === 0 ? (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            No installation items yet.
                          </p>
                          <div className="flex flex-wrap justify-center gap-2">
                            <button type="button" onClick={() => addBlankRow()} className={primaryButton}>
                              <Plus className="h-4 w-4" />
                              Add the first row
                            </button>
                            <button type="button" onClick={() => setShowPaste(true)} className={secondaryButton}>
                              <ClipboardPaste className="h-4 w-4" />
                              Paste from Excel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          No items match these filters.
                        </p>
                      )}
                    </td>
                  </tr>
                )}

                {!loading &&
                  rowViews.map((view) => {
                    const item = view.isNew ? null : items.find((i) => i.id === view.key) || null;
                    return (
                      <tr
                        key={view.key}
                        className={`${
                          view.hasError
                            ? "bg-red-50 dark:bg-red-950/30"
                            : view.isNew
                              ? "bg-teal-50/60 dark:bg-teal-950/20"
                              : view.dirty
                                ? "bg-amber-50 dark:bg-amber-950/20"
                                : "bg-white dark:bg-gray-800"
                        } ${view.isActive ? "" : "opacity-60"}`}
                      >
                        <td className="sticky left-0 z-[5] w-20 min-w-[5rem] max-w-[5rem] bg-inherit px-1.5 py-1">
                          <input
                            value={view.code}
                            onChange={(e) =>
                              item ? setItemField(item, "code", e.target.value) : setNewField(view.key, { code: e.target.value })
                            }
                            {...navProps(view, "code")}
                            placeholder="auto"
                            title="Numbered automatically - change it only if you need to"
                            aria-label="Code"
                            className={`${cellClass} ${dirtyCell(view.fieldDirty("code"))} text-gray-500`}
                          />
                        </td>
                        <td className="sticky left-20 z-[5] min-w-[240px] bg-inherit px-1.5 py-1">
                          <input
                            value={view.description}
                            onChange={(e) =>
                              item
                                ? setItemField(item, "description", e.target.value)
                                : setNewField(view.key, { description: e.target.value })
                            }
                            {...navProps(view, "description")}
                            placeholder="Description"
                            aria-label="Description"
                            className={`${cellClass} ${dirtyCell(view.fieldDirty("description"))}`}
                          />
                        </td>
                        <td className="px-1.5 py-1">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-400">$</span>
                            <input
                              value={view.salePrice}
                              inputMode="decimal"
                              onChange={(e) =>
                                item
                                  ? setItemField(item, "salePrice", e.target.value)
                                  : setNewField(view.key, { salePrice: e.target.value })
                              }
                              {...navProps(view, "salePrice")}
                              placeholder="0.00"
                              aria-label="Sale price"
                              className={`${cellClass} ${dirtyCell(view.fieldDirty("salePrice"))} text-right`}
                            />
                          </div>
                        </td>
                        <td className="px-1.5 py-1">
                          <select
                            value={view.bucket}
                            onChange={(e) =>
                              item
                                ? setItemField(item, "bucketDefault", e.target.value)
                                : setNewField(view.key, { bucketDefault: e.target.value })
                            }
                            aria-label="Bucket default"
                            className={`${cellClass} ${dirtyCell(view.fieldDirty("bucketDefault"))} ${
                              view.bucket ? "font-medium text-teal-700 dark:text-teal-300" : "text-gray-400"
                            }`}
                          >
                            <option value="">None</option>
                            <option value="STANDARD">Standard</option>
                            <option value="DOUBLE">Double</option>
                            <option value="CUSTOM">Custom</option>
                            <option value="MISC">Misc</option>
                          </select>
                        </td>
                        <td className="px-3 py-1 text-center">
                          <div className="flex items-center justify-center">
                            <Switch
                              checked={view.isActive}
                              onChange={(next) =>
                                item ? setItemField(item, "isActive", next) : setNewField(view.key, { isActive: next })
                              }
                              label={view.isActive ? "Active" : "Inactive"}
                            />
                          </div>
                        </td>
                        {activeInstallers.map((inst) => (
                          <td key={inst.id} className="px-1.5 py-1">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-300">$</span>
                              <input
                                value={view.cost(inst.id)}
                                inputMode="decimal"
                                onChange={(e) =>
                                  item
                                    ? setCost(inst.id, item.id, e.target.value)
                                    : setNewCost(view.key, inst.id, e.target.value)
                                }
                                {...navProps(view, `cost:${inst.id}`)}
                                placeholder="-"
                                aria-label={`${inst.name} cost`}
                                className={`${cellClass} ${dirtyCell(view.costDirty(inst.id))} text-right`}
                              />
                            </div>
                          </td>
                        ))}
                        <td className="px-2 py-1 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {view.isNew ? (
                              <button
                                type="button"
                                onClick={() => setNewRows((prev) => prev.filter((r) => r.key !== view.key))}
                                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                                title="Remove this new row"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            ) : view.dirty && item ? (
                              <button
                                type="button"
                                onClick={() => undoItem(item)}
                                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                                title="Undo changes to this row"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            ) : (
                              item && (
                                <button
                                  type="button"
                                  onClick={() => void deleteItem(item)}
                                  className="rounded-md p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                                  title="Delete permanently (switch off instead to keep history)"
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

          {activeInstallers.length === 0 && !loading && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No active installers yet - use the Installers button to add the ones whose costs you want to
              track; each gets its own cost column here.
            </p>
          )}

          {dirtyCount > 0 && (
            <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-lg dark:border-amber-700 dark:bg-amber-950">
              <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                {dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}
                {pendingNew.length > 0 && ` (${pendingNew.length} new row${pendingNew.length === 1 ? "" : "s"})`}
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={discardAll} disabled={saving} className={secondaryButton}>
                  Discard
                </button>
                <button type="button" onClick={() => void saveAll()} disabled={saving} className={primaryButton}>
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save all"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showPaste && (
        <PasteImportModal installers={installers} onAdd={addPasted} onClose={() => setShowPaste(false)} />
      )}
      {showInstallers && (
        <InstallersManager
          installers={installers}
          onChange={setInstallers}
          onClose={() => setShowInstallers(false)}
          notify={notify}
        />
      )}
    </SectionCard>
  );
}

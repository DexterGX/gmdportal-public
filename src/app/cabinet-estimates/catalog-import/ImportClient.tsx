"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  collectPdfColors,
  expandLevelColumns,
  mergePdfTables,
  type PdfColor,
  type PdfTableChunk,
} from "@/lib/cabinetPdfGrid";
import type { RawGrid } from "@/lib/cabinetCatalogImport";
import { colorLabel, parseLevelColumn, type ColorGroup, type ColorMode } from "@/lib/cabinetColorLevels";
import ReviewTable from "./ReviewTable";
import LogVersionUpdateModal from "../LogVersionUpdateModal";
import {
  COL_W,
  type ChangedEntry,
  type ExistingItem,
  type InstallationItemOption,
  type NormalizedItem,
  type ParsePlan,
  type Vendor,
} from "./reviewShared";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Image as ImageIcon,
  FileText,
  RefreshCw,
  Trash2,
} from "lucide-react";

// ---- History of the notes typed for the AI --------------------------------
// Stored in the database so long notes don't have to be retyped.
type NotesHistoryEntry = { id: string; text: string; vendorName: string; updatedAt: string };

function NotesHistoryPicker({
  history,
  onUse,
  onDelete,
  onClear,
}: {
  history: NotesHistoryEntry[];
  onUse: (text: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (history.length === 0) return null;
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        {open ? "Hide previous notes" : `Previous notes (${history.length})`}
      </button>
      {open && (
        <ul className="mt-1 max-h-56 divide-y divide-gray-200 overflow-y-auto rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
          {history.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2 p-2">
              <button
                type="button"
                onClick={() => {
                  onUse(entry.text);
                  setOpen(false);
                }}
                className="min-w-0 flex-1 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Use these notes"
              >
                <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                  {entry.vendorName ? `${entry.vendorName} - ` : ""}
                  {new Date(entry.updatedAt).toLocaleDateString()}
                </span>
                <span className="block whitespace-pre-wrap break-words text-xs text-gray-800 dark:text-gray-200">
                  {entry.text.length > 220 ? `${entry.text.slice(0, 220)}...` : entry.text}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(entry.id)}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                title="Remove from history"
                aria-label="Remove from history"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <button
          type="button"
          onClick={onClear}
          className="mt-1 text-xs font-medium text-red-600 hover:underline dark:text-red-400"
        >
          Clear all previous notes
        </button>
      )}
    </div>
  );
}

export default function ImportClient() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [useNewVendor, setUseNewVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState("");

  // Round 6: whether this file's prices are already at our cost, or retail
  // (in which case the selected vendor's company discount is applied at
  // preview time - see cabinetCatalogPricing.ts). Defaults to "net" so an
  // import behaves exactly as before unless an admin opts in.
  const [pricingMode, setPricingMode] = useState<"net" | "retail">("net");
  const [discountInput, setDiscountInput] = useState("0");
  const [file, setFile] = useState<File | null>(null);
  // Notes for the AI: free-text instructions/corrections used on the next read.
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [notesHistory, setNotesHistory] = useState<NotesHistoryEntry[]>([]);
  const loadNotesHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/cabinet-catalog/admin/import-notes");
      const data = await res.json();
      if (res.ok) setNotesHistory(data.notes || []);
    } catch {
      // History is a convenience - the page works without it.
    }
  }, []);
  useEffect(() => {
    void loadNotesHistory();
  }, [loadNotesHistory]);
  async function removeNotesHistory(id: string) {
    try {
      const res = await fetch(`/api/cabinet-catalog/admin/import-notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete note");
      setNotesHistory((prev) => prev.filter((e) => e.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  }
  async function clearNotesHistory() {
    if (!confirm("Delete all previous notes? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/cabinet-catalog/admin/import-notes", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear notes history");
      setNotesHistory([]);
    } catch (err: any) {
      setError(err.message);
    }
  }
  async function rememberNotes(text: string, vendorName: string) {
    try {
      await fetch("/api/cabinet-catalog/admin/import-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, vendorName }),
      });
      await loadNotesHistory();
    } catch {
      // Not being able to remember the notes must never block the import.
    }
  }
  // How the AI read the file: its own notes plus (for PDFs) reading warnings.
  const [aiNotes, setAiNotes] = useState<string[]>([]);
  const [pdfReadNotes, setPdfReadNotes] = useState<string[]>([]);
  const [showAllReadNotes, setShowAllReadNotes] = useState(false);
  // PDF price lists are read into a table first (page chunks, like the slab
  // import), then go through the normal review.
  const [pdfGrid, setPdfGrid] = useState<RawGrid | null>(null);
  const [pdfStoragePath, setPdfStoragePath] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<{
    stage: string;
    done: number;
    total: number;
  } | null>(null);
  const [pdfElapsedSec, setPdfElapsedSec] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  // Vendors with many colors split into Levels: only the Levels are price
  // columns, and this lists which Level each color belongs to.
  const [colorGroups, setColorGroups] = useState<ColorGroup[] | null>(null);
  const [colorNotes, setColorNotes] = useState<string[]>([]);
  const [colorNameMap, setColorNameMap] = useState("");
  const [colorNameMessage, setColorNameMessage] = useState<string | null>(null);

  const [resolvedVendorName, setResolvedVendorName] = useState("");
  const [parsePlan, setParsePlan] = useState<ParsePlan | null>(null);
  const [newItems, setNewItems] = useState<NormalizedItem[]>([]);
  const [changedItems, setChangedItems] = useState<ChangedEntry[]>([]);
  const [discontinuedItems, setDiscontinuedItems] = useState<ExistingItem[]>([]);
  const [discontinuedSelected, setDiscontinuedSelected] = useState<Set<string>>(new Set());
  const [installationItems, setInstallationItems] = useState<InstallationItemOption[]>([]);
  const [activeTab, setActiveTab] = useState<"new" | "changed" | "discontinued">("new");

  // Round 13: vendor catalog PDF panel (attach/replace + "Extract item
  // images"). Lives alongside the price-list upload step since both are
  // per-vendor admin actions, but is otherwise independent of the
  // preview/apply flow above - a catalog can be attached any time, not
  // just during a fresh import.
  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const [isUploadingCatalog, setIsUploadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isExtractingImages, setIsExtractingImages] = useState(false);
  const [extractResult, setExtractResult] = useState<{
    itemsUpdated: number;
    totalCodes: number;
    warnings: string[];
  } | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  // Elapsed-time counters for the two long-running catalog actions below.
  // Neither Supabase's uploadToSignedUrl nor our single extract-images POST
  // exposes real byte/step progress, so these drive an indeterminate
  // "still working" bar + a ticking timer rather than a fake percentage.
  const [uploadElapsedSec, setUploadElapsedSec] = useState(0);
  const [extractElapsedSec, setExtractElapsedSec] = useState(0);

  // Clear price list (permanent) + remove catalog (PDF and its item images).
  const [notice, setNotice] = useState<string | null>(null);
  // After a price list is applied: asks the admin to log a version update.
  const [versionPrompt, setVersionPrompt] = useState<{ vendorName: string } | null>(null);
  const [isRemovingCatalog, setIsRemovingCatalog] = useState(false);
  const [clearDialog, setClearDialog] = useState<{
    loading: boolean;
    busy: boolean;
    name: string;
    itemCount: number;
    priceCount: number;
    estimateLineCount: number;
    confirmText: string;
    error: string | null;
  } | null>(null);

  async function removeCatalog() {
    if (!vendorId || !selectedVendor) return;
    if (
      !confirm(
        `Remove the catalog for ${selectedVendor.displayName}? This deletes the attached catalog PDF and the reference pictures extracted from it. Prices and items are not affected. This cannot be undone.`,
      )
    ) {
      return;
    }
    setIsRemovingCatalog(true);
    setCatalogError(null);
    setNotice(null);
    setExtractResult(null);
    try {
      const res = await fetch(`/api/cabinet-catalog/admin/vendors/${vendorId}/catalog?images=1`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to remove the catalog");
      await loadVendors();
      setNotice(
        `Catalog removed${
          data.imagesCleared ? ` and ${data.imagesCleared} item picture${data.imagesCleared === 1 ? "" : "s"} cleared` : ""
        }.`,
      );
    } catch (err: any) {
      setCatalogError(err.message);
    } finally {
      setIsRemovingCatalog(false);
    }
  }

  async function openClearDialog() {
    if (!vendorId) return;
    setNotice(null);
    setClearDialog({
      loading: true,
      busy: false,
      name: "",
      itemCount: 0,
      priceCount: 0,
      estimateLineCount: 0,
      confirmText: "",
      error: null,
    });
    try {
      const res = await fetch(`/api/cabinet-catalog/admin/vendors/${vendorId}/items`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load the price list");
      setClearDialog((d) =>
        d
          ? {
              ...d,
              loading: false,
              name: data.name,
              itemCount: data.itemCount,
              priceCount: data.priceCount,
              estimateLineCount: data.estimateLineCount,
            }
          : d,
      );
    } catch (err: any) {
      setClearDialog((d) => (d ? { ...d, loading: false, error: err.message } : d));
    }
  }

  async function confirmClearPriceList() {
    if (!clearDialog || !vendorId) return;
    setClearDialog({ ...clearDialog, busy: true, error: null });
    try {
      const res = await fetch(`/api/cabinet-catalog/admin/vendors/${vendorId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: clearDialog.confirmText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to clear the price list");
      setNotice(
        `Price list cleared: ${data.itemsDeleted} item${data.itemsDeleted === 1 ? "" : "s"} deleted for ${clearDialog.name}.`,
      );
      setClearDialog(null);
      resetPreview();
    } catch (err: any) {
      setClearDialog((d) => (d ? { ...d, busy: false, error: err.message } : d));
    }
  }

  const loadVendors = useCallback(async () => {
    try {
      const res = await fetch("/api/cabinet-catalog/vendors");
      if (res.ok) {
        const data = await res.json();
        setVendors(data.vendors || []);
      }
    } catch {
      // non-fatal - vendor list just stays empty, "new vendor" still works
    }
  }, []);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === vendorId) || null,
    [vendors, vendorId],
  );

  // Round 13 follow-up: a real vendor catalog can easily be 100MB+ (80+
  // pages of full-color photos), well past what a normal Vercel serverless
  // function can accept as a request body. So this uploads the file
  // straight from the browser to Supabase Storage using a short-lived
  // signed URL our server hands out (step 1) - the PDF bytes never pass
  // through our own API route at all - then tells the server the
  // resulting path so it can attach it to the vendor (step 2).
  async function uploadCatalogPdf() {
    if (!catalogFile || !vendorId) return;
    setIsUploadingCatalog(true);
    setCatalogError(null);
    setExtractResult(null);
    setExtractError(null);
    setUploadElapsedSec(0);
    const uploadStartedAt = Date.now();
    const uploadTimer = setInterval(() => {
      setUploadElapsedSec(Math.round((Date.now() - uploadStartedAt) / 1000));
    }, 500);
    try {
      const signRes = await fetch(
        `/api/cabinet-catalog/admin/vendors/${vendorId}/catalog/sign-upload`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: catalogFile.name }),
        },
      );
      const signData = await signRes.json();
      if (!signRes.ok) {
        throw new Error(signData.error || "Failed to prepare upload");
      }

      const { error: uploadError } = await supabase.storage
        .from(signData.bucket)
        .uploadToSignedUrl(signData.path, signData.token, catalogFile, {
          contentType: "application/pdf",
        });
      if (uploadError) {
        throw new Error(uploadError.message || "Failed to upload catalog to storage");
      }

      const res = await fetch(`/api/cabinet-catalog/admin/vendors/${vendorId}/catalog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: signData.path, fileName: catalogFile.name }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to attach uploaded catalog");
      }
      setCatalogFile(null);
      await loadVendors();
    } catch (err: any) {
      setCatalogError(err.message);
    } finally {
      clearInterval(uploadTimer);
      setIsUploadingCatalog(false);
    }
  }

  async function extractCatalogImages() {
    if (!vendorId) return;
    if (
      !confirm(
        "Scan the attached catalog and (re)generate reference images for every item? A large, image-heavy catalog is read in several passes and can take a few minutes - keep this tab open until it finishes.",
      )
    ) {
      return;
    }
    setIsExtractingImages(true);
    setExtractError(null);
    setExtractResult(null);
    setExtractElapsedSec(0);
    const extractStartedAt = Date.now();
    const extractTimer = setInterval(() => {
      setExtractElapsedSec(Math.round((Date.now() - extractStartedAt) / 1000));
    }, 500);
    try {
      const res = await fetch(`/api/cabinet-catalog/admin/vendors/${vendorId}/extract-images`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to extract catalog images");
      }
      setExtractResult({
        itemsUpdated: data.itemsUpdated,
        totalCodes: data.totalCodes,
        warnings: data.warnings || [],
      });
    } catch (err: any) {
      setExtractError(err.message);
    } finally {
      clearInterval(extractTimer);
      setIsExtractingImages(false);
    }
  }

  // Pre-fill the discount from the selected vendor's linked company, if any -
  // still freely editable per Diego's ask ("let user mod it when uploading").
  useEffect(() => {
    const vendor = vendors.find((v) => v.id === vendorId);
    if (vendor && vendor.discount !== null) {
      setDiscountInput(String(vendor.discount));
    }
  }, [vendorId, vendors]);

  // Tier columns actually present, derived from the (post-split) item prices
  // rather than parsePlan.priceColumns - a grouped column like "CS, US" is
  // already split into two separate tiers by the time it reaches here.
  const tierNames = useMemo(() => {
    const seen: string[] = [];
    const add = (name: string) => {
      if (!seen.includes(name)) seen.push(name);
    };
    for (const item of newItems) for (const p of item.prices) add(p.tierName);
    for (const c of changedItems) for (const p of c.incoming.prices) add(p.tierName);
    return seen;
  }, [newItems, changedItems]);

  // Lets the admin rename a tier's raw header text (e.g. "CS") to its real
  // color name (e.g. "Cosmos") right here in the review screen - applied
  // when displaying and again when the import is applied.
  const [tierNameOverrides, setTierNameOverrides] = useState<Record<string, string>>({});
  function tierLabel(name: string) {
    return tierNameOverrides[name] ?? name;
  }
  const renameTier = useCallback((tierName: string, value: string) => {
    setTierNameOverrides((prev) => ({ ...prev, [tierName]: value }));
  }, []);

  // Each tier column sizes itself to roughly fit its own label instead of
  // every column sharing one cramped width (COL_W.tier as a floor) - a
  // sheet with a handful of short codes and a couple of long color names
  // no longer forces every column that narrow, or every column that wide.
  // Capped so a run of very long names can't blow the table out entirely;
  // the cell still truncates with a hover tooltip past the cap.
  const tierColWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    for (const name of tierNames) {
      const label = tierNameOverrides[name] ?? name;
      widths[name] = Math.min(190, Math.max(COL_W.tier, label.length * 7 + 48));
    }
    return widths;
  }, [tierNames, tierNameOverrides]);

  const hasDiff = parsePlan !== null;
  const readNotesAll = [...pdfReadNotes, ...aiNotes];

  function resetPreview() {
    setAiNotes([]);
    setPdfReadNotes([]);
    setPdfGrid(null);
    setPdfStoragePath(null);
    setShowAllReadNotes(false);
    setParsePlan(null);
    setNewItems([]);
    setChangedItems([]);
    setDiscontinuedItems([]);
    setDiscontinuedSelected(new Set());
    setWarnings([]);
    setShowAllWarnings(false);
    setColorGroups(null);
    setColorNotes([]);
  }

  const isPdfFile = (f: File | null) => Boolean(f && f.name.toLowerCase().endsWith(".pdf"));

  async function postJson(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  /** Uploads the PDF (once), reads it chunk by chunk with the AI, returns one merged table. */
  async function readPdfToGrid(pdf: File): Promise<{ grid: RawGrid; notes: string[] }> {
    const vendorPayload = useNewVendor
      ? { vendorName: newVendorName.trim() }
      : { vendorId };

    let path = pdfStoragePath;
    if (!path) {
      setPdfProgress({ stage: "Uploading the PDF", done: 0, total: 0 });
      const sign = await postJson("/api/cabinet-catalog/admin/import/pdf-sign-upload", {
        fileName: pdf.name,
      });
      const { error: uploadError } = await supabase.storage
        .from(sign.bucket)
        .uploadToSignedUrl(sign.path, sign.token, pdf, { contentType: "application/pdf" });
      if (uploadError) {
        throw new Error(uploadError.message || "Failed to upload the PDF");
      }
      path = sign.path as string;
      setPdfStoragePath(path);
    }

    setPdfProgress({ stage: "Opening the PDF", done: 0, total: 0 });
    const plan = await postJson("/api/cabinet-catalog/admin/import/pdf-analyze", {
      storagePath: path,
    });
    const chunks: { index: number; label: string }[] = plan.chunks || [];
    const notesOut: string[] = [...(plan.warnings || [])];
    const results: (PdfTableChunk | undefined)[] = new Array(chunks.length);
    const colorsPerChunk: (PdfColor[] | undefined)[] = new Array(chunks.length);
    const failed: string[] = [];
    let done = 0;
    let knownColumns: string[] | null = null;
    setPdfProgress({ stage: "Reading pages", done: 0, total: chunks.length });

    async function readChunk(position: number) {
      const chunk = chunks[position];
      let lastError = "";
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const data = await postJson("/api/cabinet-catalog/admin/import/pdf-extract", {
            storagePath: path,
            chunkIndex: chunk.index,
            ...vendorPayload,
            notes: notes.trim() || null,
            knownColumns,
          });
          results[position] = { columns: data.columns || [], rows: data.rows || [] };
          colorsPerChunk[position] = Array.isArray(data.colors) ? data.colors : [];
          for (const w of data.warnings || []) notesOut.push(w);
          for (const o of data.observations || []) notesOut.push(o);
          if (data.priceCheck === "unavailable") {
            notesOut.push(
              `${chunk.label}: no readable text in the PDF, so prices on these pages couldn't be double-checked automatically - compare them with the PDF.`,
            );
          }
          return;
        } catch (err: any) {
          lastError = err?.message || "Failed";
        }
      }
      failed.push(`${chunk.label} (${lastError})`);
    }

    // The first part that has a table sets the column names for the rest, so
    // continuation pages without their own headings still line up.
    let next = 0;
    while (next < chunks.length && next < 3 && !knownColumns) {
      await readChunk(next);
      done += 1;
      setPdfProgress({ stage: "Reading pages", done, total: chunks.length });
      const first = results[next];
      if (first && first.rows.length > 0 && first.columns.length > 0) knownColumns = first.columns;
      next += 1;
    }

    const CONCURRENCY = 3;
    let cursor = next;
    async function worker() {
      while (cursor < chunks.length) {
        const position = cursor++;
        await readChunk(position);
        done += 1;
        setPdfProgress({ stage: "Reading pages", done, total: chunks.length });
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, Math.max(chunks.length - next, 0)) }, () => worker()),
    );

    if (failed.length > 0) {
      notesOut.unshift(
        `${failed.length} part${failed.length === 1 ? "" : "s"} of the PDF couldn't be read and ${
          failed.length === 1 ? "is" : "are"
        } missing: ${failed.slice(0, 5).join("; ")}${failed.length > 5 ? "; ..." : ""}. Click "Re-read with notes" to try again.`,
      );
    }
    const merged = mergePdfTables(results);
    if (merged.length <= 1) {
      throw new Error(
        "The AI didn't find a price table in this PDF. Add notes for the AI describing the layout and try again, or upload the price list as an Excel file.",
      );
    }
    // Colors are printed on their own pages and the tables only carry one
    // price per level - combine them into one price column per color.
    const colors = collectPdfColors(colorsPerChunk);
    const expanded = expandLevelColumns(merged, colors);
    notesOut.push(...expanded.notes);
    return { grid: expanded.grid, notes: notesOut };
  }

  async function runPreview(
    existingPlan?: ParsePlan,
    opts?: { reread?: boolean; colorMode?: ColorMode },
  ) {
    if (!file) return;
    if (!useNewVendor && !vendorId) {
      setError("Select a vendor or choose to create a new one");
      return;
    }
    if (useNewVendor && !newVendorName.trim()) {
      setError("Enter a name for the new vendor");
      return;
    }

    setIsUploading(true);
    setError(null);
    setPdfElapsedSec(0);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setPdfElapsedSec(Math.round((Date.now() - startedAt) / 1000));
    }, 1000);

    try {
      const pdf = isPdfFile(file);
      let grid = pdfGrid;
      if (pdf && (!grid || opts?.reread)) {
        const read = await readPdfToGrid(file);
        grid = read.grid;
        setPdfGrid(grid);
        setPdfReadNotes(read.notes);
      }
      setPdfProgress(pdf ? { stage: "Analyzing the table", done: 0, total: 0 } : null);

      const formData = new FormData();
      if (pdf && grid) {
        formData.append("pdfGrid", JSON.stringify(grid));
      } else {
        formData.append("file", file);
      }
      if (useNewVendor) {
        formData.append("newVendorName", newVendorName.trim());
      } else {
        formData.append("vendorId", vendorId);
      }
      if (existingPlan) {
        formData.append("parsePlan", JSON.stringify(existingPlan));
      }
      if (notes.trim()) {
        formData.append("notes", notes.trim());
        void rememberNotes(notes.trim(), useNewVendor ? newVendorName.trim() : (selectedVendor?.displayName || ""));
      }
      formData.append("pricingMode", pricingMode);
      formData.append("discount", pricingMode === "retail" ? discountInput : "0");
      formData.append("colorMode", opts?.colorMode || "auto");

      const res = await fetch("/api/cabinet-catalog/admin/import/preview", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process file");
      }

      setResolvedVendorName(data.vendorName);
      setParsePlan(data.parsePlan);
      setInstallationItems(data.installationItems || []);
      setNewItems(data.diff.newItems);
      setChangedItems(data.diff.changedItems);
      setDiscontinuedItems(data.diff.discontinuedItems);
      setDiscontinuedSelected(
        new Set<string>(data.diff.discontinuedItems.map((i: ExistingItem) => i.id)),
      );
      setWarnings(data.warnings || []);
      setShowAllWarnings(false);
      setColorGroups(data.colorGroups || null);
      setColorNotes(data.colorNotes || []);
      setTierNameOverrides({});
      setAiNotes(data.aiNotes || []);
      setShowAllReadNotes(false);
      setActiveTab("new");
    } catch (err: any) {
      setError(err.message);
    } finally {
      clearInterval(timer);
      setPdfProgress(null);
      setIsUploading(false);
    }
  }

  async function handleApply() {
    if (!parsePlan) return;
    if (
      !confirm(
        `Apply these changes to the ${resolvedVendorName} price list? This cannot be undone.`,
      )
    ) {
      return;
    }

    setIsApplying(true);
    setError(null);
    try {
      // Apply any header renames (e.g. "CS" -> "Cosmos") before sending -
      // the real CabinetPriceTier created/matched server-side should use
      // the human-readable name the admin chose here, not the raw column text.
      const remapPrices = (prices: NormalizedItem["prices"]) =>
        prices.map((p) => ({ ...p, tierName: tierNameOverrides[p.tierName] ?? p.tierName }));
      const remappedNewItems = newItems.map((item) => ({
        ...item,
        prices: remapPrices(item.prices),
      }));
      const remappedChangedItems = changedItems.map((c) => ({
        existingId: c.existing.id,
        incoming: { ...c.incoming, prices: remapPrices(c.incoming.prices) },
      }));

      const res = await fetch("/api/cabinet-catalog/admin/import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: useNewVendor ? null : vendorId,
          newVendorName: useNewVendor ? newVendorName.trim() : null,
          newItems: remappedNewItems,
          changedItems: remappedChangedItems,
          discontinuedIds: Array.from(discontinuedSelected),
          colorGroups: colorGroups
            ? colorGroups.map((g) => ({
                ...g,
                levelName: tierNameOverrides[g.levelName] ?? g.levelName,
              }))
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to apply changes");
      }

      setNotice(
        `Import complete! Created: ${data.summary.created}, Updated: ${data.summary.updated}, Discontinued: ${data.summary.discontinued}`,
      );
      setVersionPrompt({ vendorName: resolvedVendorName });
      setFile(null);
      resetPreview();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsApplying(false);
    }
  }

  /** Edit one color's text (e.g. "Level 1 - CS" -> "Level 1 - Cream White Shaker CS"). */
  function renameColor(level: number, index: number, label: string) {
    setColorGroups((prev) =>
      prev
        ? prev.map((g) =>
            g.level !== level
              ? g
              : {
                  ...g,
                  colors: g.colors.map((c, i) => {
                    if (i !== index) return c;
                    const parsed = parseLevelColumn(label.trim());
                    return parsed
                      ? { label, name: parsed.name, code: parsed.code }
                      : { label, name: label.trim(), code: "" };
                  }),
                },
          )
        : prev,
    );
  }

  /** "CS=Cream White Shaker, WS=Weston Shaker" -> every color with that code gets the full name. */
  function applyColorNames() {
    const map = new Map<string, string>();
    for (const part of colorNameMap.split(/[\n,;]+/)) {
      const m = /^\s*([A-Za-z0-9]{1,8})\s*[=:\-–]\s*(.+?)\s*$/.exec(part);
      if (m) map.set(m[1].toUpperCase(), m[2]);
    }
    if (map.size === 0) {
      setColorNameMessage("Nothing to apply - write the names as CODE=Name, separated by commas (for example WS=Weston Shaker).");
      return;
    }
    if (!colorGroups) return;
    let changed = 0;
    setColorGroups(
      colorGroups.map((g) => ({
        ...g,
        colors: g.colors.map((c) => {
          const key = (c.code || c.name).trim().toUpperCase();
          const full = map.get(key);
          if (!full) return c;
          changed++;
          return { label: colorLabel(g.level, `${full} ${key}`), name: full, code: key };
        }),
      })),
    );
    setColorNameMessage(
      changed > 0 ? `Renamed ${changed} color${changed === 1 ? "" : "s"}.` : "No color matched those codes.",
    );
  }

  function toggleDiscontinued(id: string) {
    setDiscontinuedSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Import Cabinet Price List
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Upload a vendor&apos;s price list (any layout) and Claude will read its structure -
          codes, descriptions, price tiers, and categories - so you can review and confirm
          before anything is saved to the price list. Nothing is saved until you click Apply.
        </p>
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
          <span className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {notice}
          </span>
          <button
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="text-lg leading-none text-green-700 hover:text-green-900 dark:text-green-300"
          >
            &times;
          </button>
        </div>
      )}

      {clearDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Clear price list"
          onClick={() => !clearDialog.busy && setClearDialog(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="flex items-center gap-2 text-base font-semibold text-red-700 dark:text-red-300">
              <AlertCircle className="h-5 w-5" /> Clear price list
            </h2>
            {clearDialog.loading ? (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Loading...</p>
            ) : clearDialog.error && !clearDialog.name ? (
              <p className="mt-3 text-sm text-red-700 dark:text-red-300">{clearDialog.error}</p>
            ) : (
              <>
                <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                  This <strong>permanently deletes</strong> every imported item for{" "}
                  <strong>{clearDialog.name}</strong>: {clearDialog.itemCount} item
                  {clearDialog.itemCount === 1 ? "" : "s"} and {clearDialog.priceCount} price
                  {clearDialog.priceCount === 1 ? "" : "s"}, plus their reference pictures. It
                  cannot be undone - you would have to import the price list again.
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <li>
                    Saved estimates are not deleted and keep their saved prices
                    {clearDialog.estimateLineCount > 0
                      ? `, but ${clearDialog.estimateLineCount} line${clearDialog.estimateLineCount === 1 ? "" : "s"} will no longer be linked to the catalog (no picture, no automatic price refresh)`
                      : ""}
                    .
                  </li>
                  <li>
                    The colors/groups are removed too, so they no longer show in new estimates (a color
                    still used by a saved estimate is only hidden, and comes back if you import it
                    again). The vendor and its attached catalog PDF are kept.
                  </li>
                </ul>
                <label className="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Type <span className="font-semibold">{clearDialog.name}</span> to confirm
                </label>
                <input
                  value={clearDialog.confirmText}
                  onChange={(e) => setClearDialog({ ...clearDialog, confirmText: e.target.value })}
                  autoFocus
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                {clearDialog.error && (
                  <p className="mt-2 text-sm text-red-700 dark:text-red-300">{clearDialog.error}</p>
                )}
              </>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setClearDialog(null)}
                disabled={clearDialog.busy}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              {!clearDialog.loading && clearDialog.name && (
                <button
                  onClick={confirmClearPriceList}
                  disabled={
                    clearDialog.busy ||
                    clearDialog.confirmText.trim().toLowerCase() !==
                      clearDialog.name.trim().toLowerCase()
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {clearDialog.busy ? "Deleting..." : "Delete price list permanently"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!hasDiff && (
        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Vendor <span className="text-red-500">*</span>
              </label>
              {!useNewVendor ? (
                <div className="flex items-center gap-2">
                  <select
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">-- Choose a vendor --</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.displayName}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setUseNewVendor(true)}
                    className="whitespace-nowrap px-3 py-2 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
                  >
                    + New vendor
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    placeholder="e.g. Eucucina"
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    onClick={() => {
                      setUseNewVendor(false);
                      setNewVendorName("");
                    }}
                    className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-600 hover:underline dark:text-gray-300"
                  >
                    Use existing
                  </button>
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Import only compares and updates items for this vendor.
              </p>
            </div>

            {!useNewVendor && vendorId && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Vendor catalog (optional)
                </label>
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  Attach this vendor&apos;s product catalog (PDF with photos) to help the AI tell
                  real cabinets apart from accessories during import, and to show a reference
                  picture when building an estimate. Never used for prices - those always come
                  from the price list file above.
                </p>
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  These are two separate steps: <strong>Attach/Replace catalog</strong> only
                  uploads and stores the PDF itself - it doesn&apos;t touch any item images.{" "}
                  <strong>Extract item images</strong> is what actually reads the PDF afterward and
                  crops out a picture for each item code, which is why it&apos;s a second click and
                  can take a little while. Re-run it any time (e.g. after replacing the catalog) to
                  refresh the pictures.
                </p>
                {selectedVendor?.catalogPdfUrl ? (
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <a
                      href={selectedVendor.catalogPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline dark:text-blue-300"
                    >
                      {selectedVendor.catalogPdfFileName || "Current catalog"}
                    </a>
                    {selectedVendor.catalogUploadedAt && (
                      <span>
                        (uploaded {new Date(selectedVendor.catalogUploadedAt).toLocaleDateString()})
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                    No catalog attached yet.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      setCatalogFile(e.target.files?.[0] || null);
                      setCatalogError(null);
                    }}
                    className="block max-w-xs flex-1 cursor-pointer rounded-lg border border-gray-300 bg-white text-xs text-gray-900 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                  <button
                    onClick={uploadCatalogPdf}
                    disabled={!catalogFile || isUploadingCatalog}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {isUploadingCatalog
                      ? "Uploading..."
                      : selectedVendor?.catalogPdfUrl
                        ? "Replace catalog"
                        : "Attach catalog"}
                  </button>
                  <button
                    onClick={extractCatalogImages}
                    disabled={!selectedVendor?.catalogPdfUrl || isExtractingImages}
                    title={
                      !selectedVendor?.catalogPdfUrl
                        ? "Attach a catalog PDF first"
                        : "Scan the catalog and update item images"
                    }
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    {isExtractingImages ? "Extracting..." : "Extract item images"}
                  </button>
                  <button
                    onClick={removeCatalog}
                    disabled={isRemovingCatalog || isUploadingCatalog || isExtractingImages}
                    title="Delete the attached catalog PDF and the pictures extracted from it"
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isRemovingCatalog ? "Removing..." : "Remove catalog"}
                  </button>
                </div>

                {isUploadingCatalog && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div className="h-full w-full animate-pulse bg-gray-700" />
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Uploading
                      {catalogFile ? ` ${(catalogFile.size / (1024 * 1024)).toFixed(1)} MB` : ""}
                      ... {uploadElapsedSec}s elapsed. Large catalogs can take a few minutes - keep
                      this tab open.
                    </p>
                  </div>
                )}
                {isExtractingImages && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div className="h-full w-full animate-pulse bg-blue-600" />
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Reading the catalog and matching item photos... {extractElapsedSec}s elapsed.
                      A large catalog is read in several passes and can take a few minutes.
                    </p>
                  </div>
                )}
                {catalogError && (
                  <p className="mt-2 text-xs text-red-700 dark:text-red-300">{catalogError}</p>
                )}
                {extractError && (
                  <p className="mt-2 text-xs text-red-700 dark:text-red-300">{extractError}</p>
                )}
                {extractResult && (
                  <div className="mt-2 text-xs text-gray-700 dark:text-gray-300">
                    <p>
                      Matched images for {extractResult.itemsUpdated} of {extractResult.totalCodes}{" "}
                      items.
                    </p>
                    {extractResult.warnings.length > 0 && (
                      <ul className="mt-1 list-inside list-disc text-amber-700 dark:text-amber-400">
                        {extractResult.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {!useNewVendor && vendorId && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/20">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Clear imported price list
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Permanently deletes every imported item and price for{" "}
                    {selectedVendor?.displayName || "this vendor"}. Saved estimates are kept.
                  </p>
                </div>
                <button
                  onClick={openClearDialog}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" /> Clear price list
                </button>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Pricing
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="pricingMode"
                    checked={pricingMode === "net"}
                    onChange={() => setPricingMode("net")}
                  />
                  Prices already at our cost
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="pricingMode"
                    checked={pricingMode === "retail"}
                    onChange={() => setPricingMode("retail")}
                  />
                  Prices are retail / list price
                </label>
                {pricingMode === "retail" && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Discount</span>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      max="1"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      className="w-24 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {pricingMode === "retail"
                  ? "Discount is a fraction off retail (e.g. 0.3000 = 30% off) - applied to every price in this file before you review it. Pre-filled from this vendor's Cabinet Companies discount, if set."
                  : "No adjustment - prices in the file are used as our cost, same as today."}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Price list file
              </label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.pdf"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setPdfGrid(null);
                  setPdfStoragePath(null);
                  setError(null);
                }}
                className="block w-full cursor-pointer rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-900 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                PDF, CSV, XLS, or XLSX. Any layout - Claude figures out the columns. A PDF is read a
                couple of pages at a time and every price is checked against the PDF&apos;s text, so it
                takes longer than a spreadsheet.
              </p>
            </div>

            {file && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                {isPdfFile(file) ? (
                  <FileText className="h-4 w-4" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                <span>{file.name}</span>
                <span className="text-gray-400">
                  ({file.size > 1024 * 1024
                    ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                    : `${(file.size / 1024).toFixed(1)} KB`})
                </span>
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={() => setShowNotes((v) => !v)}
                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {showNotes ? "Hide notes for the AI" : "Add notes for the AI (optional)"}
              </button>
              {showNotes && (
                <div className="mt-2">
                  <NotesHistoryPicker history={notesHistory} onUse={setNotes} onDelete={removeNotesHistory} onClear={clearNotesHistory} />
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    maxLength={4000}
                    placeholder='Tell the AI anything it should know, e.g. "The WS column is retail - ignore it" or "Codes starting with W are wall cabinets".'
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Used when the AI reads the file. If it gets something wrong, add a note after
                    the preview and use &quot;Re-read with notes&quot;.
                  </p>
                </div>
              )}
            </div>

            {isUploading && pdfProgress && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-100">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span>
                    {pdfProgress.stage}
                    {pdfProgress.total > 0 ? ` - part ${Math.min(pdfProgress.done, pdfProgress.total)} of ${pdfProgress.total}` : "..."}
                  </span>
                  <span className="text-xs">{pdfElapsedSec}s</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900">
                  <div
                    className={`h-full bg-blue-600 ${pdfProgress.total > 0 ? "" : "w-full animate-pulse"}`}
                    style={
                      pdfProgress.total > 0
                        ? { width: `${Math.round((pdfProgress.done / pdfProgress.total) * 100)}%` }
                        : undefined
                    }
                  />
                </div>
                <p className="mt-1.5 text-xs">Keep this tab open until it finishes.</p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <AlertCircle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <button
              onClick={() => runPreview()}
              disabled={!file || isUploading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {isUploading ? "Reading with AI..." : "Upload & Analyze with AI"}
            </button>
          </div>
        </div>
      )}

      {hasDiff && parsePlan && (
        <div className="space-y-4">
          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600 dark:text-green-400" />
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Import Preview - {resolvedVendorName}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {newItems.length} new, {changedItems.length} updated,{" "}
                    {discontinuedItems.length} no longer in the file
                  </p>
                  <p
                    className="truncate text-xs text-gray-500 dark:text-gray-400"
                    title={`Read sheet "${parsePlan.sheetName}" - ${tierNames.length} price tier${tierNames.length === 1 ? "" : "s"}: ${tierNames.map((t) => tierLabel(t)).join(", ")}`}
                  >
                    {isPdfFile(file) ? "Read PDF" : `Read sheet "${parsePlan.sheetName}"`} - {tierNames.length} price
                    tier{tierNames.length === 1 ? "" : "s"}:{" "}
                    {tierNames.map((t) => tierLabel(t)).join(", ")}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  onClick={() => setShowNotes((v) => !v)}
                  disabled={isUploading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  <RefreshCw className="h-4 w-4" />
                  {isUploading ? "Re-reading..." : "Re-read with notes"}
                </button>
                <button
                  onClick={() => {
                    resetPreview();
                    setFile(null);
                    setError(null);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  disabled={isApplying}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  {isApplying ? "Applying..." : "Apply to Price List"}
                </button>
              </div>
            </div>

            {showNotes && (
              <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notes for the AI - tell it what it got wrong, then re-read the file
                </label>
                <NotesHistoryPicker history={notesHistory} onUse={setNotes} onDelete={removeNotesHistory} onClear={clearNotesHistory} />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder='e.g. "The last price column is retail - ignore it" or "Treat the section headings in capitals as categories".'
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() => runPreview(undefined, { reread: true })}
                    disabled={isUploading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isUploading ? "Re-reading..." : "Re-read file"}
                  </button>
                  {isUploading && pdfProgress && (
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {pdfProgress.stage}
                      {pdfProgress.total > 0 ? ` - part ${Math.min(pdfProgress.done, pdfProgress.total)} of ${pdfProgress.total}` : "..."} ({pdfElapsedSec}s)
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Re-reading replaces the rows below with a fresh read; edits you made in the review
                  tables are lost.
                </p>
              </div>
            )}

            {readNotesAll.length > 0 && (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-100">
                <p className="mb-1 font-medium">Notes from reading the file</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {(showAllReadNotes ? readNotesAll : readNotesAll.slice(0, 4)).map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
                {readNotesAll.length > 4 && (
                  <button
                    onClick={() => setShowAllReadNotes((v) => !v)}
                    className="mt-1.5 font-medium underline hover:no-underline"
                  >
                    {showAllReadNotes ? "Show less" : `Show all ${readNotesAll.length} notes`}
                  </button>
                )}
              </div>
            )}

            {(colorGroups || colorNotes.length > 0 || tierNames.length >= 8) && (
              <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {colorGroups
                      ? `Colors grouped by level - ${colorGroups.reduce((n, g) => n + g.colors.length, 0)} colors in ${colorGroups.length} level${colorGroups.length === 1 ? "" : "s"}`
                      : "Colors"}
                  </p>
                  <button
                    onClick={() => {
                      if (
                        !confirm(
                          "Read the file again with this change? Edits you made in the review tables are lost.",
                        )
                      ) {
                        return;
                      }
                      void runPreview(parsePlan, { colorMode: colorGroups ? "columns" : "levels" });
                    }}
                    disabled={isUploading}
                    className="rounded-lg border border-indigo-300 bg-white px-3 py-1 font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-100"
                  >
                    {colorGroups ? "Use one column per color instead" : "Group colors into levels"}
                  </button>
                </div>
                {colorNotes.length > 0 && (
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {colorNotes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
                {colorGroups && (
                  <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                    {colorGroups.map((g) => (
                      <div key={g.level}>
                        <p className="font-medium">
                          {tierLabel(g.levelName)} ({g.colors.length})
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {g.colors.map((c, ci) => (
                            <input
                              key={ci}
                              value={c.label}
                              size={Math.max(10, c.label.length + 1)}
                              onChange={(e) => renameColor(g.level, ci, e.target.value)}
                              title="Click to rename this color"
                              className="rounded-full border border-transparent bg-white px-2 py-0.5 text-[11px] text-indigo-900 outline-none hover:border-indigo-300 focus:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-100"
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {colorGroups && (
                  <div className="mt-3 border-t border-indigo-200 pt-2 dark:border-indigo-800">
                    <p className="font-medium">Rename colors by code</p>
                    <p className="mt-0.5 text-indigo-800 dark:text-indigo-200">
                      Click any color above to rename it, or paste the names here as CODE=Name (or CODE-Name),
                      separated by commas, to rename every color with that code at once.
                    </p>
                    <div className="mt-1 flex flex-wrap items-start gap-2">
                      <textarea
                        value={colorNameMap}
                        onChange={(e) => setColorNameMap(e.target.value)}
                        rows={2}
                        placeholder="WS=Weston Shaker, CS=Cream White Shaker, US=Unfinished Birch Shaker"
                        className="min-w-[18rem] flex-1 rounded-lg border border-indigo-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-indigo-700 dark:bg-indigo-950 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={applyColorNames}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
                      >
                        Apply names
                      </button>
                    </div>
                    {colorNameMessage && <p className="mt-1 text-indigo-800 dark:text-indigo-200">{colorNameMessage}</p>}
                  </div>
                )}
              </div>
            )}

            {warnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                <p className="mb-1 font-medium">{warnings.length} row(s) skipped:</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {(showAllWarnings ? warnings : warnings.slice(0, 10)).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                {warnings.length > 10 && (
                  <button
                    onClick={() => setShowAllWarnings((v) => !v)}
                    className="mt-1.5 font-medium text-amber-900 underline hover:no-underline dark:text-amber-100"
                  >
                    {showAllWarnings ? "Show less" : `Show all ${warnings.length}`}
                  </button>
                )}
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}
          </div>

          <div className="rounded-lg bg-white shadow dark:bg-gray-800">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {(["new", "changed", "discontinued"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {tab} (
                  {tab === "new"
                    ? newItems.length
                    : tab === "changed"
                      ? changedItems.length
                      : discontinuedItems.length}
                  )
                </button>
              ))}
            </div>

            <div className="overflow-x-auto p-4">
              {(activeTab === "new" || activeTab === "changed") && (
                <ReviewTable
                  key={activeTab}
                  mode={activeTab}
                  newItems={newItems}
                  changedItems={changedItems}
                  setNewItems={setNewItems}
                  setChangedItems={setChangedItems}
                  tierNames={tierNames}
                  tierColWidths={tierColWidths}
                  tierLabel={tierLabel}
                  onRenameTier={renameTier}
                  installationItems={installationItems}
                />
              )}

              {activeTab === "discontinued" && (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-500 dark:text-gray-400">
                      <th className="p-2">Mark inactive</th>
                      <th className="p-2">Code</th>
                      <th className="p-2">Description</th>
                      <th className="p-2">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discontinuedItems.map((item) => (
                      <tr key={item.id} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={discontinuedSelected.has(item.id)}
                            onChange={() => toggleDiscontinued(item.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                          />
                        </td>
                        <td className="p-2 text-gray-700 dark:text-gray-300">{item.code}</td>
                        <td className="p-2 text-gray-700 dark:text-gray-300">{item.description}</td>
                        <td className="p-2 text-gray-500 dark:text-gray-400">{item.category || "-"}</td>
                      </tr>
                    ))}
                    {discontinuedItems.length === 0 && (
                      <tr>
                        <td className="p-4 text-center text-gray-400" colSpan={4}>
                          Nothing missing from the file
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Columns read wrong? Correct the fields above before applying, or use &quot;Re-run
            AI&quot; to have Claude read the file again from scratch.
          </p>
        </div>
      )}

      {versionPrompt && (
        <LogVersionUpdateModal
          title="Price list imported - log a version update?"
          defaultNote={`Updated ${versionPrompt.vendorName} price list`}
          onClose={(logged) => {
            setVersionPrompt(null);
            if (logged) setNotice((prev) => `${prev ? `${prev}. ` : ""}Version updated to ${logged}.`);
          }}
        />
      )}
    </div>
  );
}

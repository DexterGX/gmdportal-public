"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import {
  SLAB_TEMPLATE_COL_WIDTHS,
  computeRowIssues,
  countBlockingErrors,
  rowsToTemplateAoa,
  templateFileName,
  type SlabTemplateRow,
} from "@/lib/slabsTemplate";
import ReviewRows from "./ReviewRows";
import PreviewChanges from "./PreviewChanges";
import type { Brand, PreviewDiff, PreviewSummary } from "./types";

type Step = "upload" | "reading" | "review" | "preview";
type SourceKind = "template" | "pdf" | "sheet";
type ReadPhase = "upload" | "analyze" | "ai";
type Chunk = { index: number; label: string };
type FailedChunk = Chunk & { error: string };
type Notice = { id: number; type: "success" | "error" | "info"; message: string };

type ChunkResult =
  | {
      ok: true;
      rows: SlabTemplateRow[];
      warnings: string[];
      observations: string[];
      priceCheck: "checked" | "unavailable";
      fallback: boolean;
    }
  | { ok: false; error: string };

// Parallel AI calls while reading a file - enough to finish a long PDF in a
// reasonable time without hammering the API rate limit.
const CONCURRENCY = 4;
const ACCEPT = ".pdf,.xlsx,.xls,.csv";

const EXAMPLE_ROWS: SlabTemplateRow[] = [
  {
    id: "example-1",
    series: "Q1",
    code: "OQ29",
    color: "Simply Beige",
    finish: "POLISHED",
    heightIn: 136,
    widthIn: 79,
    thickness: "2cm",
    sfPrice: 35.5,
    slabPrice: null,
    status: "AVAILABLE",
  },
  {
    id: "example-2",
    series: "Q1",
    code: "OQ30",
    color: "Elegant White",
    finish: "POLISHED",
    heightIn: 136,
    widthIn: 79,
    thickness: "3cm",
    sfPrice: null,
    slabPrice: 2800,
    status: "AVAILABLE",
  },
];

class RequestError extends Error {}

async function postJson(url: string, body: unknown, signal?: AbortSignal) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 504) {
      throw new RequestError("This part took too long to read. Try again, or split the file into smaller files.");
    }
    throw new RequestError(data.error || `Request failed (${res.status})`);
  }
  return data;
}

async function downloadRowsAsTemplate(rows: SlabTemplateRow[], brandName: string, suffix: string) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet(rowsToTemplateAoa(rows, brandName));
  sheet["!cols"] = SLAB_TEMPLATE_COL_WIDTHS.map((wch) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Price List");
  XLSX.writeFile(workbook, templateFileName(brandName, suffix));
}

function isAbort(err: unknown) {
  return err instanceof DOMException && err.name === "AbortError";
}

function StepPills({ step }: { step: Step }) {
  const steps = [
    { key: "upload", label: "Upload" },
    { key: "review", label: "Review & edit rows" },
    { key: "preview", label: "Preview & apply" },
  ];
  const activeIndex = step === "preview" ? 2 : step === "review" ? 1 : 0;
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
              i === activeIndex
                ? "bg-blue-600 text-white"
                : i < activeIndex
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                  : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {i + 1}. {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-gray-300 dark:text-gray-600">›</span>}
        </li>
      ))}
    </ol>
  );
}

export default function ImportClient() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [brandId, setBrandId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [step, setStep] = useState<Step>("upload");

  // Reading progress
  const [readPhase, setReadPhase] = useState<ReadPhase>("upload");
  const [chunkTotal, setChunkTotal] = useState(0);
  const [chunkDone, setChunkDone] = useState(0);
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const [rowsFound, setRowsFound] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // What was read
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [sourceKind, setSourceKind] = useState<SourceKind | null>(null);
  const [sourceDetail, setSourceDetail] = useState("");
  const [chunks, setChunks] = useState<Chunk[]>([]);
  // Spreadsheets: row-by-row parts used only if Claude can't map the layout.
  const [fallbackChunks, setFallbackChunks] = useState<Chunk[]>([]);
  const [failedChunks, setFailedChunks] = useState<FailedChunk[]>([]);
  const [readWarnings, setReadWarnings] = useState<string[]>([]);
  const [observations, setObservations] = useState<string[]>([]);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [priceCheckUnavailable, setPriceCheckUnavailable] = useState(false);
  const [rows, setRows] = useState<SlabTemplateRow[]>([]);

  // Preview / apply
  const [preview, setPreview] = useState<{ diff: PreviewDiff; summary: PreviewSummary } | null>(null);
  const [discontinuedSelected, setDiscontinuedSelected] = useState<Set<string>>(new Set());
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [notices, setNotices] = useState<Notice[]>([]);
  const noticeId = useRef(0);

  function notify(type: Notice["type"], message: string) {
    const id = ++noticeId.current;
    setNotices((prev) => [...prev, { id, type, message }]);
    if (type !== "error") {
      setTimeout(() => setNotices((prev) => prev.filter((n) => n.id !== id)), 6000);
    }
  }

  const brand = brands.find((b) => b.id === brandId) || null;
  const issues = useMemo(() => computeRowIssues(rows), [rows]);
  const blockingCount = useMemo(() => countBlockingErrors(issues), [issues]);

  useEffect(() => {
    async function loadBrands() {
      try {
        const res = await fetch("/api/slabs/admin/brands");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load brands");
        setBrands(data.brands || []);
      } catch (err: any) {
        setBrandsError(err.message || "Failed to load brands");
      } finally {
        setBrandsLoading(false);
      }
    }
    loadBrands();
  }, []);

  // Elapsed timer while reading
  useEffect(() => {
    if (step !== "reading") return;
    const started = Date.now();
    setElapsedSec(0);
    const timer = setInterval(() => setElapsedSec(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [step]);

  // Don't lose reviewed/edited rows to an accidental tab close.
  useEffect(() => {
    if (!(step === "review" || step === "preview") || rows.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step, rows.length]);

  /* ---------------------------------------------------------------- */
  /* Reading                                                           */
  /* ---------------------------------------------------------------- */

  async function runChunks(list: Chunk[], path: string, fileName: string, signal: AbortSignal) {
    const results: (ChunkResult | undefined)[] = new Array(list.length);
    let cursor = 0;
    setChunkTotal(list.length);
    setChunkDone(0);
    setActiveLabels([]);

    async function worker() {
      while (cursor < list.length && !signal.aborted) {
        const position = cursor++;
        const chunk = list[position];
        setActiveLabels((prev) => [...prev, chunk.label]);
        try {
          const data = await postJson(
            "/api/slabs/admin/import/extract",
            { brandId, storagePath: path, fileName, chunkIndex: chunk.index, notes },
            signal,
          );
          results[position] = {
            ok: true,
            rows: data.rows || [],
            warnings: data.warnings || [],
            observations: data.observations || [],
            priceCheck: data.priceCheck === "unavailable" ? "unavailable" : "checked",
            fallback: Boolean(data.fallback),
          };
          setRowsFound((n) => n + (data.rows?.length || 0));
        } catch (err: any) {
          if (signal.aborted) return;
          results[position] = { ok: false, error: err.message || "Failed" };
        } finally {
          setActiveLabels((prev) => prev.filter((l) => l !== chunk.label));
          setChunkDone((n) => n + 1);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, () => worker()));
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");

    const newRows: SlabTemplateRow[] = [];
    const warnings: string[] = [];
    const obs: string[] = [];
    const failed: FailedChunk[] = [];
    let unavailable = false;
    let fallback = false;
    results.forEach((result, i) => {
      if (!result) return;
      if (result.ok) {
        if (result.fallback) fallback = true;
        newRows.push(...result.rows);
        warnings.push(...result.warnings);
        obs.push(...result.observations);
        if (result.priceCheck === "unavailable") unavailable = true;
      } else {
        failed.push({ ...list[i], error: result.error });
      }
    });
    return { newRows, warnings, obs, failed, unavailable, fallback };
  }

  /** Runs the parts; if the spreadsheet layout couldn't be mapped, reads it row by row instead. */
  async function readParts(list: Chunk[], fallbackList: Chunk[], path: string, fileName: string, signal: AbortSignal) {
    const first = await runChunks(list, path, fileName, signal);
    if (!first.fallback || fallbackList.length === 0) return first;
    const second = await runChunks(fallbackList, path, fileName, signal);
    return {
      newRows: [...first.newRows, ...second.newRows],
      warnings: [...first.warnings, ...second.warnings],
      obs: [...first.obs, ...second.obs],
      failed: [...first.failed, ...second.failed],
      unavailable: first.unavailable || second.unavailable,
      fallback: true,
    };
  }

  function resetRead() {
    setRows([]);
    setPreview(null);
    setFailedChunks([]);
    setReadWarnings([]);
    setObservations([]);
    setShowAllNotes(false);
    setPriceCheckUnavailable(false);
    setChunks([]);
    setFallbackChunks([]);
    setSourceKind(null);
    setSourceDetail("");
    setRowsFound(0);
  }

  async function startRead() {
    if (!file || !brandId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    resetRead();
    setStep("reading");
    setReadPhase("upload");

    try {
      const sign = await postJson(
        "/api/slabs/admin/import/sign-upload",
        { brandId, fileName: file.name },
        controller.signal,
      );
      const { error: uploadError } = await supabase.storage
        .from(sign.bucket)
        .uploadToSignedUrl(sign.path, sign.token, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (uploadError) throw new RequestError(uploadError.message || "Upload to storage failed");
      if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
      setStoragePath(sign.path);

      setReadPhase("analyze");
      const plan = await postJson(
        "/api/slabs/admin/import/analyze",
        { brandId, storagePath: sign.path, fileName: file.name },
        controller.signal,
      );
      setReadWarnings(plan.warnings || []);

      if (plan.kind === "template") {
        setSourceKind("template");
        setSourceDetail(`template file (sheet "${plan.sheetName}")`);
        setRows(plan.rows || []);
        setStep("review");
        notify("success", `Read ${plan.rows.length} rows from the template file - no AI needed.`);
        return;
      }

      const list: Chunk[] = (plan.chunks || []).map((c: any) => ({ index: c.index, label: c.label }));
      const fallbackList: Chunk[] = (plan.fallbackChunks || []).map((c: any) => ({ index: c.index, label: c.label }));
      setSourceKind(plan.kind);
      setSourceDetail(plan.kind === "pdf" ? `${plan.totalPages}-page PDF` : "spreadsheet");
      setChunks(list);
      setFallbackChunks(fallbackList);
      setReadPhase("ai");

      const result = await readParts(list, fallbackList, sign.path, file.name, controller.signal);
      if (result.newRows.length === 0 && result.failed.length > 0) {
        throw new RequestError(`The AI couldn't read this file: ${result.failed[0]?.error || "unknown error"}`);
      }
      setRows(result.newRows);
      setReadWarnings((prev) => [...prev, ...result.warnings]);
      setObservations(result.obs);
      setFailedChunks(result.failed);
      setPriceCheckUnavailable(result.unavailable);
      setStep("review");
      if (result.failed.length > 0) {
        notify("error", `${result.failed.length} part(s) of the file couldn't be read - you can retry them.`);
      } else if (result.newRows.length === 0) {
        notify("info", "The AI didn't find any slab rows. Check the file, add notes for the AI and re-read, or add rows by hand.");
      } else {
        notify("success", `Claude read ${result.newRows.length} rows. Review them before comparing.`);
      }
    } catch (err: any) {
      setStep("upload");
      if (isAbort(err)) notify("info", "Reading cancelled.");
      else notify("error", err.message || "Failed to read the file");
    } finally {
      abortRef.current = null;
    }
  }

  /** Retry failed parts (append) or re-read everything with the current AI notes (replace). */
  async function rerun(mode: "failed" | "all") {
    if (!storagePath || !file || chunks.length === 0) return;
    if (
      mode === "all" &&
      rows.length > 0 &&
      !confirm("Re-read the whole file with the AI? The current rows (and any edits you made) will be replaced.")
    ) {
      return;
    }
    const list = mode === "failed" ? failedChunks.map(({ index, label }) => ({ index, label })) : chunks;
    const fallbackList = mode === "failed" ? [] : fallbackChunks;
    const controller = new AbortController();
    abortRef.current = controller;
    setRowsFound(0);
    setReadPhase("ai");
    setStep("reading");
    try {
      const result = await readParts(list, fallbackList, storagePath, file.name, controller.signal);
      if (mode === "all") {
        setRows(result.newRows);
        setReadWarnings(result.warnings);
        setObservations(result.obs);
        setPriceCheckUnavailable(result.unavailable);
      } else {
        setRows((prev) => [...prev, ...result.newRows]);
        setReadWarnings((prev) => [...prev, ...result.warnings]);
        setObservations((prev) => [...prev, ...result.obs]);
        if (result.unavailable) setPriceCheckUnavailable(true);
      }
      setFailedChunks(result.failed);
      setPreview(null);
      if (result.failed.length > 0) notify("error", `${result.failed.length} part(s) still couldn't be read.`);
      else notify("success", `Read ${result.newRows.length} rows.`);
    } catch (err: any) {
      if (isAbort(err)) notify("info", "Reading cancelled - your previous rows were kept.");
      else notify("error", err.message || "Failed to read the file");
    } finally {
      abortRef.current = null;
      setStep("review");
    }
  }

  function cancelRead() {
    abortRef.current?.abort();
  }

  function startOver() {
    if ((step === "review" || step === "preview") && rows.length > 0 && !confirm("Discard these rows and start over?")) {
      return;
    }
    resetRead();
    setFile(null);
    setStoragePath(null);
    setStep("upload");
  }

  /* ---------------------------------------------------------------- */
  /* Preview / apply                                                   */
  /* ---------------------------------------------------------------- */

  async function buildPreview() {
    if (blockingCount > 0) {
      notify("error", `Fix the ${blockingCount} row(s) with errors first (filter Issues → "Has errors").`);
      return;
    }
    setIsPreviewing(true);
    try {
      const data = await postJson("/api/slabs/admin/import/preview", { brandId, rows });
      setPreview({ diff: data.diff, summary: data.summary });
      // Safety: when more slabs would be marked unavailable than the new list
      // even contains, it's usually a partial list (one page/collection) or
      // old duplicates - don't pre-check them; let the admin choose.
      const missingCount = data.diff.discontinuedSlabs.length;
      const largeMissing = missingCount > 0 && missingCount > data.summary.totalProcessed;
      setDiscontinuedSelected(
        largeMissing ? new Set<string>() : new Set<string>(data.diff.discontinuedSlabs.map((s: { id: string }) => s.id)),
      );
      if (largeMissing) {
        notify(
          "info",
          `${missingCount} current slabs aren't in this file - more than the file itself has. None are pre-selected to be marked unavailable; review the "Not in new list" tab first.`,
        );
      }
      setStep("preview");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      notify("error", err.message || "Failed to build the preview");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function applyImport() {
    if (!preview || !brand) return;
    const { summary } = preview;
    if (
      !confirm(
        `Apply to the ${brand.name} price list?\n\n` +
          `• ${summary.newCount} new slab(s)\n` +
          `• ${summary.changedCount} updated\n` +
          `• ${discontinuedSelected.size} marked unavailable`,
      )
    ) {
      return;
    }
    setIsApplying(true);
    try {
      const data = await postJson("/api/slabs/admin/import/apply", {
        brandId,
        rows,
        discontinuedIds: Array.from(discontinuedSelected),
        storagePath,
      });
      notify(
        "success",
        `Import complete for ${brand.name}: ${data.summary.created} created, ${data.summary.updated} updated, ${data.summary.discontinued} marked unavailable.`,
      );
      resetRead();
      setFile(null);
      setStoragePath(null);
      setStep("upload");
    } catch (err: any) {
      notify("error", err.message || "Failed to apply changes");
    } finally {
      setIsApplying(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Export / downloads                                                */
  /* ---------------------------------------------------------------- */

  async function exportCurrent() {
    if (!brand) return;
    setIsExporting(true);
    try {
      const res = await fetch(`/api/slabs/admin/export?brandId=${encodeURIComponent(brand.id)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = match?.[1] || templateFileName(brand.name, "price_list");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notify("success", `Exported the current ${brand.name} price list.`);
    } catch (err: any) {
      notify("error", err.message || "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  async function downloadReviewedRows() {
    if (!brand) return;
    setIsDownloading(true);
    try {
      await downloadRowsAsTemplate(rows, brand.name, "import");
    } catch (err: any) {
      notify("error", err.message || "Download failed");
    } finally {
      setIsDownloading(false);
    }
  }

  async function downloadBlankTemplate() {
    try {
      await downloadRowsAsTemplate(EXAMPLE_ROWS, brand?.name || "Daltile", "template");
    } catch (err: any) {
      notify("error", err.message || "Download failed");
    }
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  const allNotes = [...readWarnings, ...observations];
  const shownNotes = showAllNotes ? allNotes : allNotes.slice(0, 4);
  const progressPct = chunkTotal > 0 ? Math.round((chunkDone / chunkTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Notifications */}
      <div className="pointer-events-none fixed right-4 top-20 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {notices.map((n) => (
          <div
            key={n.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border p-3 text-sm shadow-lg ${
              n.type === "error"
                ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                : n.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
                  : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200"
            }`}
          >
            {n.type === "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : n.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="flex-1">{n.message}</span>
            <button
              type="button"
              onClick={() => setNotices((prev) => prev.filter((x) => x.id !== n.id))}
              className="opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Import / Export Price List</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Upload a supplier&apos;s price list as a PDF or Excel file in any layout and Claude will read it into the GMD
            template. You can review and edit every row, then preview the changes. Nothing is saved until you click Apply.
          </p>
        </div>
        <StepPills step={step === "reading" ? (rows.length > 0 ? "review" : "upload") : step} />
      </div>

      {/* ------------------------------ UPLOAD ------------------------------ */}
      {step === "upload" && (
        <>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-1 items-start gap-3">
                <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">GMD template format</h3>
                  <code className="mt-1 inline-block rounded bg-blue-100 px-1 py-0.5 text-xs text-blue-900 dark:bg-blue-900/40 dark:text-blue-100">
                    Brand | Series | Code | Color | Finish | H | W | Thickness | SF_Price | Slab_Price | Status
                  </code>
                  <p className="mt-2 text-sm text-blue-800 dark:text-blue-200">
                    Files already in this format are read directly. Any other layout - and every PDF - is read by Claude
                    and converted into these columns for you to review.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={downloadBlankTemplate}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
              >
                <Download className="h-4 w-4" /> Download template
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Brand <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    disabled={brandsLoading}
                    className="block h-10 w-full flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">{brandsLoading ? "Loading brands..." : "-- Choose a brand --"}</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={exportCurrent}
                    disabled={!brand || isExporting}
                    title="Download this brand's current slabs in the GMD template (edit in Excel and re-import)"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Export current price list
                  </button>
                </div>
                {brandsError ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{brandsError}</p>
                ) : !brandsLoading && brands.length === 0 ? (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    No brands yet - add one under Brand Settings first.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    The import only compares and updates slabs for this brand.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Price list file <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept={ACCEPT}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="block w-full cursor-pointer rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-900 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
                {file ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    {file.name.toLowerCase().endsWith(".pdf") ? (
                      <FileText className="h-4 w-4" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                    <span>{file.name}</span>
                    <span className="text-gray-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">PDF, Excel (.xlsx / .xls) or CSV.</p>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowNotes((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  <Sparkles className="h-4 w-4" />
                  {showNotes ? "Hide notes for the AI" : "Add notes for the AI (optional)"}
                </button>
                {showNotes && (
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    maxLength={4000}
                    placeholder={'e.g. "Use the Fabricator column, not Retail." · "All slabs are 130 x 65." · "Prices are per square foot." · "Ignore the Outdoor collection."'}
                    className="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={startRead}
                disabled={!file || !brandId}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" /> Read file
              </button>
            </div>
          </div>
        </>
      )}

      {/* ------------------------------ READING ----------------------------- */}
      {step === "reading" && (
        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-blue-600" />
            <div className="flex-1 space-y-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {readPhase === "upload"
                    ? "Uploading file..."
                    : readPhase === "analyze"
                      ? "Checking the file..."
                      : `Claude is reading ${file?.name || "the file"}...`}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {readPhase === "ai"
                    ? `${chunkDone} of ${chunkTotal} parts done · ${rowsFound} rows found so far · ${elapsedSec}s`
                    : `${elapsedSec}s`}
                </p>
              </div>
              {readPhase === "ai" && (
                <>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.max(3, progressPct)}%` }} />
                  </div>
                  {activeLabels.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Reading {activeLabels.join(", ")}</p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Each part takes about a minute. Long price lists can take a few minutes - keep this tab open.
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={cancelRead}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------ REVIEW ------------------------------ */}
      {step === "review" && (
        <>
          <div className="space-y-3 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Review rows · {brand?.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {rows.length} row{rows.length === 1 ? "" : "s"} from {file?.name} (
                  {sourceKind === "template" ? `read directly as a ${sourceDetail}` : `read by Claude from a ${sourceDetail}`}).
                  Edit anything below; SF and Listed update as you type.
                </p>
              </div>
              {sourceKind !== "template" && chunks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowNotes((v) => !v)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  <RefreshCw className="h-4 w-4" /> Re-read with notes
                </button>
              )}
            </div>

            {sourceKind !== "template" && showNotes && (
              <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Notes for the AI - tell it what it got wrong, then re-read the whole file
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder={'e.g. "Use the Fabricator column, not Retail." · "Jumbo slabs are 130 x 65."'}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => rerun("all")}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Sparkles className="h-4 w-4" /> Re-read whole file
                </button>
              </div>
            )}

            {sourceKind && sourceKind !== "template" && (
              <div
                className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
                  priceCheckUnavailable
                    ? "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                    : "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200"
                }`}
              >
                {priceCheckUnavailable ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>
                  {priceCheckUnavailable
                    ? "Some pages have no readable text (likely scanned), so their prices couldn't be checked automatically. Compare those prices with the PDF carefully."
                    : "Every price was checked against the numbers in the file. Any price that wasn't found is flagged “double-check” below."}
                </span>
              </div>
            )}

            {failedChunks.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                <div>
                  <p className="font-medium">
                    {failedChunks.length} part{failedChunks.length === 1 ? "" : "s"} couldn&apos;t be read:
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {failedChunks.map((c) => (
                      <li key={c.index}>
                        {c.label}: {c.error}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => rerun("failed")}
                  className="inline-flex items-center gap-1.5 self-start rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  <RefreshCw className="h-4 w-4" /> Retry failed parts
                </button>
              </div>
            )}

            {allNotes.length > 0 && (
              <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Notes from reading the file
                </p>
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-700 dark:text-gray-300">
                  {shownNotes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
                {allNotes.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllNotes((v) => !v)}
                    className="mt-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {showAllNotes ? "Show less" : `Show all ${allNotes.length} notes`}
                  </button>
                )}
              </div>
            )}
          </div>

          <ReviewRows
            rows={rows}
            onChange={(updater) => {
              setRows(updater);
              setPreview(null);
            }}
            issues={issues}
            onDownload={downloadReviewedRows}
            isDownloading={isDownloading}
          />

          <div className="sticky bottom-0 z-20 -mx-6 flex flex-col gap-2 border-t border-gray-200 bg-white/95 px-6 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-gray-700 dark:bg-gray-900/95">
            <button
              type="button"
              onClick={startOver}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="h-4 w-4" /> Start over
            </button>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              {blockingCount > 0 && (
                <span className="text-sm text-red-600 dark:text-red-400">
                  Fix {blockingCount} row{blockingCount === 1 ? "" : "s"} with errors to continue
                </span>
              )}
              <button
                type="button"
                onClick={buildPreview}
                disabled={blockingCount > 0 || rows.length === 0 || isPreviewing}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Compare with current price list
              </button>
            </div>
          </div>
        </>
      )}

      {/* ------------------------------ PREVIEW ----------------------------- */}
      {step === "preview" && preview && (
        <>
          <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow sm:flex-row sm:items-center sm:justify-between dark:bg-gray-800">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-600 dark:text-green-400" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Preview · {brand?.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {preview.summary.newCount} new · {preview.summary.changedCount} updated ·{" "}
                  {preview.summary.unchangedCount} unchanged · {discontinuedSelected.size} of{" "}
                  {preview.summary.discontinuedCount} missing slab(s) will be marked unavailable
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Final prices use this brand&apos;s current discount, profit factor, tax and delivery fee.
                </p>
                {preview.summary.discontinuedCount > preview.summary.totalProcessed && (
                  <p className="mt-1 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                    More current slabs are missing from this file ({preview.summary.discontinuedCount}) than the file
                    contains ({preview.summary.totalProcessed}). If this file is only part of the price list, or the
                    brand has old duplicate slabs, check the &quot;Not in new list&quot; tab before marking any unavailable.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("review")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <ArrowLeft className="h-4 w-4" /> Back to edit rows
              </button>
              <button
                type="button"
                onClick={applyImport}
                disabled={isApplying}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {isApplying ? "Applying..." : "Apply changes"}
              </button>
            </div>
          </div>

          <PreviewChanges
            diff={preview.diff}
            summary={preview.summary}
            discontinuedSelected={discontinuedSelected}
            onDiscontinuedChange={setDiscontinuedSelected}
          />
        </>
      )}
    </div>
  );
}

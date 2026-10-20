"use client";

import { ReactNode, useEffect } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

export type Notify = (type: "success" | "error", message: string) => void;

export type ToastState = { id: number; type: "success" | "error"; message: string } | null;

/* ------------------------------ helpers ------------------------------ */

export function parseNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = parseFloat(String(value ?? "").replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function sameNumber(a: string | number | null | undefined, b: string | number | null | undefined) {
  return Math.abs(parseNumber(a) - parseNumber(b)) < 0.0000001;
}

/* ----------------------------- shared styles ---------------------------- */

export const fieldClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

// Borderless-until-hover input used inside table cells, so a table of
// inputs reads like a spreadsheet instead of a wall of boxes.
export const cellClass =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-gray-900 outline-none transition hover:border-gray-300 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/30 dark:text-gray-100 dark:hover:border-gray-600 dark:focus:bg-gray-900";

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700";

/* ------------------------------- layout ------------------------------- */

export function SectionCard({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5 dark:border-gray-700">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-teal-600" : "bg-gray-300 dark:bg-gray-600"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function Modal({
  title,
  description,
  onClose,
  children,
  wide,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`my-4 w-full ${
          wide ? "max-w-5xl" : "max-w-2xl"
        } rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-700">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            {description && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ToastView({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, toast.type === "error" ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;
  const isError = toast.type === "error";
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex max-w-sm justify-end">
      <div
        role="status"
        className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3.5 py-3 text-sm shadow-lg ${
          isError
            ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            : "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
        }`}
      >
        {isError ? (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <span className="flex-1">{toast.message}</span>
        <button type="button" onClick={onClose} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

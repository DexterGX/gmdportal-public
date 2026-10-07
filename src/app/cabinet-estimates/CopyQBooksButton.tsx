"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";

type Props = {
  estimateNumber: string | null | undefined;
  brand: string | null | undefined;
  color: string | null | undefined;
  className?: string;
  // Optional hook so the host page can raise its own success/error toast.
  onResult?: (ok: boolean, text: string) => void;
};

// Text pasted into QuickBooks: one field per line.
export function buildQBooksText(
  estimateNumber: string | null | undefined,
  brand: string | null | undefined,
  color: string | null | undefined,
): string {
  return [
    `Estimate#: ${estimateNumber || ""}`.trimEnd(),
    `Brand: ${brand || ""}`.trimEnd(),
    `Color: ${color || ""}`.trimEnd(),
  ].join("\n");
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export default function CopyQBooksButton({
  estimateNumber,
  brand,
  color,
  className,
  onResult,
}: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function handleClick() {
    const text = buildQBooksText(estimateNumber, brand, color);
    const ok = await copyText(text);
    onResult?.(ok, text);
    if (ok) {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!estimateNumber}
      title={
        estimateNumber
          ? "Copy Estimate#, Brand and Color for QuickBooks"
          : "Save the estimate first"
      }
      className={
        className ||
        "inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
      }
    >
      {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
      {copied ? "Copied!" : "Copy to Q.Books"}
    </button>
  );
}

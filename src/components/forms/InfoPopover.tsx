"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

export type InfoPopoverItem = { title: string; text: string };

type Props = {
  heading: string;
  items: InfoPopoverItem[];
  emptyText?: string;
  ariaLabel?: string;
};

// Small (i) button that opens a floating explanation card. Rendered in a
// portal so it is never clipped by an overflow-hidden parent.
export default function InfoPopover({ heading, items, emptyText, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const cardId = useId();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || cardRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function close() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const el = btnRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const width = 288;
      const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
      const below = r.bottom + 6;
      // Open upwards when there's not enough room underneath.
      const top = window.innerHeight - below < 220 ? Math.max(8, r.top - 6 - 220) : below;
      setPos({ top, left });
    }
    setOpen(true);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={ariaLabel || heading}
        aria-expanded={open}
        aria-controls={cardId}
        title={heading}
        className="inline-flex shrink-0 items-center justify-center rounded-full text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        <Info className="h-4 w-4" />
      </button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={cardRef}
            id={cardId}
            role="dialog"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: 288 }}
            className="z-[70] max-h-72 overflow-y-auto rounded-lg border border-gray-300 bg-white p-3 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-800"
          >
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {heading}
            </div>
            {items.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400">
                {emptyText || "Nothing to show yet."}
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.title}>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      {item.title}
                    </div>
                    <div className="whitespace-pre-line text-gray-600 dark:text-gray-300">
                      {item.text.trim() || (
                        <span className="italic text-gray-400">No explanation added yet.</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

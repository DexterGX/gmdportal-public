"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type RoundedMultiSelectOption = {
  value: string;
  label: string;
};

type Props = {
  values: string[];
  onChange: (values: string[]) => void;
  options: RoundedMultiSelectOption[];
  // Text shown on the trigger when nothing is selected.
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  // Minimum width of the popup menu in px (it is never narrower than the trigger).
  menuMinWidth?: number;
  ariaLabel?: string;
};

// Multi-choice sibling of RoundedSelect for the estimate header rows: same
// transparent trigger and portal menu (so it is never clipped by the header's
// overflow), but picking an option toggles it and the menu stays open.
export default function RoundedMultiSelect({
  values,
  onChange,
  options,
  placeholder = "-- None --",
  disabled = false,
  className = "",
  menuMinWidth = 180,
  ariaLabel,
}: Props) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; bottom: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, bottom: r.bottom, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onScroll(e: Event) {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setOpen(false);
    }
    function onResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  function toggle(value: string) {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === "Escape") {
      setOpen(false);
    } else if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const MENU_MAX_HEIGHT = 256;
  let menuStyle: React.CSSProperties | undefined;
  if (open && rect && typeof window !== "undefined") {
    const width = Math.max(rect.width, menuMinWidth);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < Math.min(MENU_MAX_HEIGHT, options.length * 28 + 8) && rect.top > spaceBelow;
    menuStyle = {
      position: "fixed",
      left,
      width,
      ...(openUp ? { bottom: window.innerHeight - rect.top + 2 } : { top: rect.bottom + 2 }),
      maxHeight: MENU_MAX_HEIGHT,
    };
  }

  const labelFor = (value: string) => options.find((o) => o.value === value)?.label ?? value;
  const summary = values.map(labelFor).join(", ");

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={ariaLabel}
        disabled={disabled}
        title={summary || undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-1 bg-transparent px-2 py-0.5 text-left text-[11px] text-gray-900 outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100 ${className}`}
      >
        <span className={`min-w-0 truncate ${values.length ? "" : "text-gray-500 dark:text-gray-400"}`}>
          {values.length ? summary : placeholder}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 text-gray-500 dark:text-gray-400" />
      </button>
      {open &&
        menuStyle &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="listbox"
            aria-multiselectable="true"
            style={menuStyle}
            className="z-[70] overflow-y-auto rounded-lg border border-gray-300 bg-white p-1 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-800"
          >
            {options.length === 0 && (
              <p className="px-2 py-1.5 text-gray-500 dark:text-gray-400">No options available</p>
            )}
            {options.map((opt) => {
              const isSelected = values.includes(opt.value);
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  key={opt.value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(opt.value)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-gray-900 hover:bg-blue-50 dark:text-gray-100 dark:hover:bg-gray-700"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected ? "border-blue-600 bg-blue-600" : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <span className="min-w-0 break-words">{opt.label}</span>
                </button>
              );
            })}
            {values.length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChange([])}
                className="mt-1 w-full rounded-md border-t border-gray-200 px-2 py-1.5 text-left text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                Clear selection
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

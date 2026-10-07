"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type RoundedSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: RoundedSelectOption[];
  // Text shown on the trigger when `value` matches no option.
  placeholder?: string;
  disabled?: boolean;
  // "bare" = transparent, fills its cell (header rows);
  // "boxed" = small bordered control (footer / summary rows).
  variant?: "bare" | "boxed";
  className?: string;
  // Minimum width of the popup menu in px (it is never narrower than the trigger).
  menuMinWidth?: number;
  ariaLabel?: string;
};

// Replacement for a native <select> whose option popup is square and
// unstyleable. The menu matches the look of the item-code suggestions dropdown:
// rounded border, shadow, light-blue hover.
export default function RoundedSelect({
  value,
  onChange,
  options,
  placeholder = "-- Select --",
  disabled = false,
  variant = "bare",
  className = "",
  menuMinWidth = 140,
  ariaLabel,
}: Props) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [rect, setRect] = useState<{
    top: number;
    bottom: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((o) => o.value === value);

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
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) {
        return;
      }
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

  function openMenu() {
    if (disabled) return;
    const idx = options.findIndex((o) => o.value === value && !o.disabled);
    setActiveIndex(idx);
    setOpen(true);
  }

  function choose(opt: RoundedSelectOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function moveActive(delta: number) {
    if (options.length === 0) return;
    let idx = activeIndex;
    for (let i = 0; i < options.length; i += 1) {
      idx = (idx + delta + options.length) % options.length;
      if (!options[idx].disabled) break;
    }
    setActiveIndex(idx);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[activeIndex];
      if (opt) choose(opt);
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
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 2 }
        : { top: rect.bottom + 2 }),
      maxHeight: MENU_MAX_HEIGHT,
    };
  }

  const triggerBase =
    variant === "bare"
      ? "w-full bg-transparent px-2 py-0.5 text-[11px]"
      : "rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] dark:border-gray-600 dark:bg-gray-900";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`flex items-center justify-between gap-1 text-left text-gray-900 outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100 ${triggerBase} ${className}`}
      >
        <span className={`min-w-0 truncate ${selected ? "" : "text-gray-500 dark:text-gray-400"}`}>
          {selected ? selected.label : placeholder}
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
            style={menuStyle}
            className="z-[70] overflow-y-auto rounded-lg border border-gray-300 bg-white p-1 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-800"
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  key={`${opt.value}-${i}`}
                  disabled={opt.disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(opt)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100 ${
                    i === activeIndex
                      ? "bg-blue-50 dark:bg-gray-700"
                      : "hover:bg-blue-50 dark:hover:bg-gray-700"
                  } ${isSelected ? "font-semibold" : ""}`}
                >
                  <span className="min-w-0 break-words">{opt.label}</span>
                  {isSelected ? <Check className="h-3 w-3 shrink-0 text-blue-600" /> : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  maxSuggestions?: number;
}

// Compact type-ahead combobox: free typing is always allowed, matching
// suggestions appear in a small styled dropdown underneath (unlike the native
// <datalist>, which renders an oversized, unstyled browser popup).
export default function Combobox({
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder,
  className,
  maxSuggestions = 8,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = value.trim()
    ? suggestions.filter((s) => s.toLowerCase().includes(value.trim().toLowerCase()))
    : suggestions;
  const visible = filtered.slice(0, maxSuggestions);

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && visible.length > 0 && (
        <div className="absolute z-20 mt-0.5 max-h-48 w-full min-w-[140px] overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {visible.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                onSelect?.(s);
                setOpen(false);
              }}
              className="block w-full truncate px-2.5 py-1.5 text-left hover:bg-blue-50 dark:hover:bg-gray-700"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

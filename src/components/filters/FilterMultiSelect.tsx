"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

type Props = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  fullWidth?: boolean;
  matchInputStyle?: boolean;
  showSelectedNames?: boolean;
};

export default function FilterMultiSelect({
  label,
  options,
  selected,
  onChange,
  fullWidth = false,
  matchInputStyle = false,
  showSelectedNames = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const displayText =
    selected.length === 0
      ? "Any"
      : selected.length === 1
        ? selected[0]
        : showSelectedNames
          ? selected.join(", ")
          : `${selected.length} selected`;

  const triggerClassName = matchInputStyle
    ? `flex h-10 ${fullWidth ? "w-full" : "inline-flex"} items-center justify-between gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-700 dark:text-gray-300 transition-colors hover:border-gray-400 dark:hover:border-gray-600`
    : `${fullWidth ? "w-full justify-between" : "inline-flex"} items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
        selected.length > 0
          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
          : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
      }`;

  return (
    <div
      className={fullWidth ? "relative w-full" : "relative"}
      ref={dropdownRef}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClassName}
      >
        {matchInputStyle ? (
          <span className="truncate">{`${label}: ${displayText}`}</span>
        ) : (
          <>
            <span className="font-medium">{label}:</span>
            <span>{displayText}</span>
          </>
        )}
        <ChevronDown
          className={`w-4 h-4 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`${fullWidth ? "w-full min-w-56" : "w-56"} absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto`}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              No options available
            </div>
          ) : (
            <div className="py-1">
              {options.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleOption(option)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected
                          ? "bg-blue-600 border-blue-600"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-gray-900 dark:text-gray-100">
                      {option || "(empty)"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

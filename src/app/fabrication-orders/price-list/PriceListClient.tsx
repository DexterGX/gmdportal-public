"use client";

import { useMemo, useState } from "react";
import { Printer, Search, X } from "lucide-react";
import {
  FABRICATION_SETTINGS_CATEGORIES,
  type FabricationSettingsCategoryConfig,
  type FabricationSettingsCategory,
} from "@/lib/fabricationSettings";

type Item = {
  id: string;
  name: string;
  isBuildUp?: boolean;
  [key: string]: unknown;
};

interface Props {
  items: Record<FabricationSettingsCategory, Item[]>;
  visibleCategories: FabricationSettingsCategory[];
}

function formatValue(value: unknown, prefix?: string, suffix?: string) {
  const n = Number(value ?? 0);
  const formatted = prefix === "$" ? n.toFixed(2) : n.toString();
  return `${prefix ?? ""}${formatted}${suffix ?? ""}`;
}

// table-layout: fixed needs explicit column widths up front, otherwise the
// browser's auto-sizing algorithm can squeeze the Name column so tight at
// print scale that its text visually collides with the Price column next
// to it instead of wrapping. Widths vary by how many columns a category has.
function getColWidths(config: FabricationSettingsCategoryConfig) {
  if (config.dbField && config.hasBuildUpFlag) {
    return { name: "54%", value: "28%", buildUp: "18%" };
  }
  if (config.dbField) {
    return { name: "62%", value: "38%", buildUp: undefined };
  }
  return { name: "100%", value: undefined, buildUp: undefined };
}

const card =
  "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 print:rounded-none print:shadow-none print:border-gray-400 print:mb-2 print:break-inside-auto";

export default function PriceListClient({ items, visibleCategories }: Props) {
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();

  const categories = useMemo(
    () =>
      FABRICATION_SETTINGS_CATEGORIES.filter((config) =>
        visibleCategories.includes(config.category),
      ),
    [visibleCategories],
  );

  const filteredItems = useMemo(() => {
    if (!q) return items;
    const result: Record<string, Item[]> = {};
    categories.forEach((config) => {
      result[config.category] = (items[config.category] || []).filter((item) =>
        item.name.toLowerCase().includes(q),
      );
    });
    return result as Record<FabricationSettingsCategory, Item[]>;
  }, [items, q, categories]);

  const hasAnyResults = categories.some(
    (config) => (filteredItems[config.category] || []).length > 0,
  );

  return (
    <div className="space-y-6 pb-10 print:space-y-1 print:pb-0">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Fabrication Order Price List
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Reference pricing for every active option used to calculate fabrication orders.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>

      {/* Print-only header, since the app chrome (including the h1 above) is hidden when printing. */}
      <div className="hidden print:mb-1 print:block">
        <h1 className="text-sm font-bold text-gray-900">Fabrication Order Price List</h1>
        <p className="text-[9px] text-gray-600">Printed {new Date().toLocaleDateString()}</p>
      </div>

      <div className="relative max-w-sm print:hidden">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-9 text-sm dark:border-gray-600 dark:bg-gray-900"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            title="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!hasAnyResults && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          {categories.length === 0
            ? "No price categories are currently shown here — an admin can turn them back on in Settings."
            : `No prices match "${search}".`}
        </div>
      )}

      {/* Screen: responsive grid. Print: CSS multi-column flow instead of
          grid — grid items that don't fit the remaining page height get
          pushed as a whole, which was leaving near-blank pages; columns let
          shorter cards pack in around a tall one instead. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 print:block print:columns-4 print:gap-2">
        {categories.map((config) => {
          const rows = filteredItems[config.category] || [];
          if (q && rows.length === 0) return null;

          return (
            <div key={config.category} className={`${card} p-4 print:p-1.5`}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 print:text-[8px] print:text-black">
                {config.label}
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 print:hidden">
                {config.description}
              </p>

              {rows.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400 dark:text-gray-500 print:mt-1 print:text-[8px]">
                  No active entries.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto print:mt-1 print:overflow-hidden">
                  {(() => {
                    const widths = getColWidths(config);
                    return (
                      <table className="w-full table-fixed border-collapse text-left text-sm print:text-[8.5px]">
                        <colgroup>
                          <col style={{ width: widths.name }} />
                          {config.dbField && <col style={{ width: widths.value }} />}
                          {config.hasBuildUpFlag && <col style={{ width: widths.buildUp }} />}
                        </colgroup>
                        <thead>
                          <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400 print:border-gray-400 print:text-[7.5px]">
                            <th className="py-1.5 pr-2 print:py-0.5 print:pr-1">Name</th>
                            {config.dbField && (
                              <th className="py-1.5 pl-2 text-right print:py-0.5 print:pl-1">
                                {config.valueLabel}
                              </th>
                            )}
                            {config.hasBuildUpFlag && (
                              <th className="py-1.5 pl-2 text-center print:py-0.5 print:pl-1">
                                Build-Up
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((item) => (
                            <tr
                              key={item.id}
                              className="break-inside-avoid border-b border-gray-100 last:border-0 dark:border-gray-700/60 print:border-gray-200"
                            >
                              <td className="whitespace-normal break-words py-1.5 pr-2 text-gray-900 [overflow-wrap:anywhere] dark:text-gray-100 print:py-0.5 print:pr-1">
                                {item.name}
                              </td>
                              {config.dbField && (
                                <td className="py-1.5 pl-2 text-right font-medium text-gray-900 dark:text-gray-100 print:py-0.5 print:pl-1">
                                  {formatValue(
                                    item[config.dbField],
                                    config.valuePrefix,
                                    config.valueSuffix,
                                  )}
                                </td>
                              )}
                              {config.hasBuildUpFlag && (
                                <td className="py-1.5 pl-2 text-center text-gray-600 dark:text-gray-400 print:py-0.5 print:pl-1">
                                  {item.isBuildUp ? "Yes" : "No"}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

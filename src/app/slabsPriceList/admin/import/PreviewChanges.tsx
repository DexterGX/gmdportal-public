"use client";

import { useState } from "react";
import { formatCurrency, type PreviewDiff, type PreviewSummary } from "./types";

type Props = {
  diff: PreviewDiff;
  summary: PreviewSummary;
  discontinuedSelected: Set<string>;
  onDiscontinuedChange: (next: Set<string>) => void;
};

type Tab = "new" | "changed" | "discontinued";

const th = "px-3 py-2 font-medium";
const td = "px-3 py-2 align-top";
const changedCls = "rounded bg-yellow-100 px-1 dark:bg-yellow-900/40";

function pctChange(oldValue: number, newValue: number) {
  if (!oldValue) return null;
  const pct = ((newValue - oldValue) / oldValue) * 100;
  if (Math.abs(pct) < 0.05) return null;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function OldNew({
  oldText,
  newText,
  changed,
  extra,
}: {
  oldText: string;
  newText: string;
  changed: boolean;
  extra?: string | null;
}) {
  if (!changed) return <span className="text-gray-700 dark:text-gray-300">{newText}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="text-gray-400 line-through">{oldText}</span>
      <span>→</span>
      <span className={`font-medium text-gray-900 dark:text-white ${changedCls}`}>{newText}</span>
      {extra && <span className="text-[11px] text-gray-500 dark:text-gray-400">({extra})</span>}
    </span>
  );
}

export default function PreviewChanges({ diff, summary, discontinuedSelected, onDiscontinuedChange }: Props) {
  const [tab, setTab] = useState<Tab>(
    summary.newCount > 0 ? "new" : summary.changedCount > 0 ? "changed" : "discontinued",
  );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "new", label: "New slabs", count: summary.newCount },
    { key: "changed", label: "Updated", count: summary.changedCount },
    { key: "discontinued", label: "Not in new list", count: summary.discontinuedCount },
  ];

  const allDiscontinuedSelected =
    diff.discontinuedSlabs.length > 0 && diff.discontinuedSlabs.every((s) => discontinuedSelected.has(s.id));

  function toggleDiscontinued(id: string) {
    const next = new Set(discontinuedSelected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onDiscontinuedChange(next);
  }

  return (
    <div className="rounded-lg bg-white shadow dark:bg-gray-800">
      <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto p-2 sm:p-4">
        {tab === "new" &&
          (diff.newSlabs.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">No new slabs in this import.</p>
          ) : (
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>Series</th>
                  <th className={th}>Color</th>
                  <th className={th}>Finish</th>
                  <th className={th}>Size</th>
                  <th className={th}>Thick.</th>
                  <th className={`${th} text-right`}>SF</th>
                  <th className={`${th} text-right`}>SF Price</th>
                  <th className={`${th} text-right`}>Slab Price</th>
                  <th className={`${th} text-right`}>Listed</th>
                  <th className={`${th} text-right`}>Final</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-900 dark:divide-gray-700/60 dark:text-gray-100">
                {diff.newSlabs.map((slab, idx) => (
                  <tr key={slab.key}>
                    <td className={`${td} text-gray-500`}>{idx + 1}</td>
                    <td className={td}>{slab.series || "—"}</td>
                    <td className={`${td} font-medium`}>{slab.color}</td>
                    <td className={td}>{slab.finish}</td>
                    <td className={td}>
                      {slab.heightIn} × {slab.widthIn}
                    </td>
                    <td className={td}>{slab.thickness}</td>
                    <td className={`${td} text-right tabular-nums`}>{slab.squareFeet.toFixed(1)}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatCurrency(slab.sfPrice)}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatCurrency(slab.slabPrice)}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatCurrency(slab.listedPrice)}</td>
                    <td className={`${td} text-right tabular-nums font-medium`}>{formatCurrency(slab.finalPrice)}</td>
                    <td className={td}>{slab.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}

        {tab === "changed" &&
          (diff.changedSlabs.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              No existing slabs change with this import.
            </p>
          ) : (
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>Color</th>
                  <th className={th}>Finish / Thick.</th>
                  <th className={th}>Series / Code</th>
                  <th className={th}>Size</th>
                  <th className={th}>Listed</th>
                  <th className={th}>Final</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-900 dark:divide-gray-700/60 dark:text-gray-100">
                {diff.changedSlabs.map(({ existing, incoming, changes }, idx) => {
                  const sizeChanged = changes.includes("heightIn") || changes.includes("widthIn");
                  return (
                    <tr key={existing.id}>
                      <td className={`${td} text-gray-500`}>{idx + 1}</td>
                      <td className={`${td} font-medium`}>
                        {existing.color}
                        {existing.slabNumber != null && (
                          <span className="ml-1 text-xs font-normal text-gray-500">#{existing.slabNumber}</span>
                        )}
                      </td>
                      <td className={td}>
                        {existing.finish} · {existing.thickness}
                      </td>
                      <td className={td}>
                        <div>
                          <OldNew
                            oldText={existing.series || "—"}
                            newText={incoming.series || "—"}
                            changed={changes.includes("series")}
                          />
                        </div>
                        <div className="text-xs">
                          <OldNew
                            oldText={existing.code || "—"}
                            newText={incoming.code || "—"}
                            changed={changes.includes("code")}
                          />
                        </div>
                      </td>
                      <td className={td}>
                        <OldNew
                          oldText={`${existing.heightIn} × ${existing.widthIn}`}
                          newText={`${incoming.heightIn} × ${incoming.widthIn}`}
                          changed={sizeChanged}
                        />
                      </td>
                      <td className={`${td} tabular-nums`}>
                        <OldNew
                          oldText={formatCurrency(existing.listedPrice)}
                          newText={formatCurrency(incoming.listedPrice)}
                          changed={changes.includes("listedPrice")}
                          extra={pctChange(existing.listedPrice, incoming.listedPrice)}
                        />
                      </td>
                      <td className={`${td} tabular-nums`}>
                        <OldNew
                          oldText={formatCurrency(existing.finalPrice)}
                          newText={formatCurrency(incoming.finalPrice)}
                          changed={changes.includes("finalPrice")}
                          extra={pctChange(existing.finalPrice, incoming.finalPrice)}
                        />
                      </td>
                      <td className={td}>
                        <OldNew oldText={existing.status} newText={incoming.status} changed={changes.includes("status")} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}

        {tab === "discontinued" &&
          (diff.discontinuedSlabs.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Every current slab for this brand is in the new list.
              {summary.alreadyUnavailableCount > 0 &&
                ` (${summary.alreadyUnavailableCount} already-unavailable slab${
                  summary.alreadyUnavailableCount === 1 ? " is" : "s are"
                } also missing and will stay unavailable.)`}
            </p>
          ) : (
            <div className="space-y-2">
              <p className="px-1 text-xs text-gray-600 dark:text-gray-400">
                These slabs are in GMD but not in the new list. Checked slabs will be marked{" "}
                <strong>UNAVAILABLE</strong> (they are not deleted). Uncheck any you want to leave as they are.
              </p>
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                  <tr>
                    <th className={th}>
                      <input
                        type="checkbox"
                        checked={allDiscontinuedSelected}
                        onChange={() =>
                          onDiscontinuedChange(
                            allDiscontinuedSelected
                              ? new Set()
                              : new Set(diff.discontinuedSlabs.map((s) => s.id)),
                          )
                        }
                        aria-label="Select all"
                      />
                    </th>
                    <th className={th}>Slab #</th>
                    <th className={th}>Series</th>
                    <th className={th}>Color</th>
                    <th className={th}>Finish</th>
                    <th className={th}>Size</th>
                    <th className={th}>Thick.</th>
                    <th className={`${th} text-right`}>Listed</th>
                    <th className={th}>Current status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-900 dark:divide-gray-700/60 dark:text-gray-100">
                  {diff.discontinuedSlabs.map((slab) => (
                    <tr key={slab.id} className={discontinuedSelected.has(slab.id) ? "" : "opacity-60"}>
                      <td className={td}>
                        <input
                          type="checkbox"
                          checked={discontinuedSelected.has(slab.id)}
                          onChange={() => toggleDiscontinued(slab.id)}
                          aria-label={`Mark ${slab.color} unavailable`}
                        />
                      </td>
                      <td className={`${td} text-gray-500`}>{slab.slabNumber ?? "—"}</td>
                      <td className={td}>{slab.series || "—"}</td>
                      <td className={`${td} font-medium`}>{slab.color}</td>
                      <td className={td}>{slab.finish}</td>
                      <td className={td}>
                        {slab.heightIn} × {slab.widthIn}
                      </td>
                      <td className={td}>{slab.thickness}</td>
                      <td className={`${td} text-right tabular-nums`}>{formatCurrency(slab.listedPrice)}</td>
                      <td className={td}>{slab.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Modal, fieldClass, primaryButton, secondaryButton } from "./parametersUi";
import type { InstallerRow } from "./InstallersManager";

export type PastedItem = {
  code: string;
  description: string;
  salePrice: string;
  bucketDefault: string;
  costs: Record<string, string>;
};

type Target = string; // "ignore" | "code" | "description" | "salePrice" | "bucket" | "cost:<installerId>"

const NUMBER_RE = /^\$?\s*-?\d[\d,]*(\.\d+)?$/;

function splitLines(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  let delimiter: string | null = null;
  if (lines.some((l) => l.includes("\t"))) delimiter = "\t";
  else if (lines.some((l) => l.includes(";"))) delimiter = ";";
  else {
    // Commas only count as a separator when every line has the same number of
    // them - otherwise it is just text like "Crown Molding, 96 inch".
    const counts = lines.map((l) => (l.match(/,/g) || []).length);
    if (counts[0] > 0 && counts.every((c) => c === counts[0])) delimiter = ",";
  }
  return lines.map((l) =>
    (delimiter ? l.split(delimiter) : [l]).map((c) => c.trim().replace(/^"(.*)"$/, "$1")),
  );
}

function isNumberCell(value: string): boolean {
  return NUMBER_RE.test(value.trim());
}

function detectHeader(rows: string[][], installers: InstallerRow[]): boolean {
  if (rows.length < 2) return false;
  const first = rows[0];
  if (first.some((c) => isNumberCell(c))) return false;
  return first.some(
    (c) =>
      /code|desc|item|price|sale|bucket|cost|name|sku/i.test(c) ||
      installers.some((i) => c.toLowerCase().includes(i.name.toLowerCase())),
  );
}

function guessTargets(rows: string[][], hasHeader: boolean, installers: InstallerRow[]): Target[] {
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const targets: Target[] = new Array(width).fill("ignore");
  if (width === 0) return targets;

  if (hasHeader) {
    const header = rows[0];
    header.forEach((raw, i) => {
      const h = raw.toLowerCase();
      const installer = installers.find((x) => h.includes(x.name.toLowerCase()));
      if (installer) targets[i] = `cost:${installer.id}`;
      else if (/bucket/.test(h)) targets[i] = "bucket";
      else if (/sale|price|retail|\$/.test(h)) targets[i] = "salePrice";
      else if (/^(code|sku|#|no\.?|number)$|\bcode\b/.test(h)) targets[i] = "code";
      else if (/desc|item|name|service/.test(h)) targets[i] = "description";
    });
    if (targets.includes("description")) return targets;
  }

  const data = hasHeader ? rows.slice(1) : rows;
  const numeric: boolean[] = [];
  const integers: boolean[] = [];
  for (let c = 0; c < width; c++) {
    const cells = data.map((r) => (r[c] ?? "").trim()).filter(Boolean);
    numeric[c] = cells.length > 0 && cells.every(isNumberCell);
    integers[c] = numeric[c] && cells.every((v) => /^\d{1,5}$/.test(v));
  }
  const used = new Set<number>();
  let descIdx = -1;
  for (let c = 0; c < width; c++) {
    if (!numeric[c]) {
      descIdx = c;
      break;
    }
  }
  if (descIdx === -1) descIdx = 0;
  targets[descIdx] = "description";
  used.add(descIdx);
  for (let c = 0; c < descIdx; c++) {
    if (integers[c] && !used.has(c)) {
      targets[c] = "code";
      used.add(c);
      break;
    }
  }
  let priceDone = targets.includes("salePrice");
  let installerPos = 0;
  for (let c = 0; c < width; c++) {
    if (used.has(c) || !numeric[c]) continue;
    if (!priceDone) {
      targets[c] = "salePrice";
      priceDone = true;
    } else if (installerPos < installers.length) {
      targets[c] = `cost:${installers[installerPos].id}`;
      installerPos += 1;
    }
  }
  return targets;
}

function normalizeBucket(value: string): string {
  const m = value.trim().match(/^(standard|double|custom|misc)/i);
  return m ? m[1].toUpperCase() : "";
}

export default function PasteImportModal({
  installers,
  onAdd,
  onClose,
}: {
  installers: InstallerRow[];
  onAdd: (items: PastedItem[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [headerOverride, setHeaderOverride] = useState<boolean | null>(null);
  const [targetOverride, setTargetOverride] = useState<Target[] | null>(null);

  const rows = useMemo(() => splitLines(text), [text]);
  const hasHeader = headerOverride ?? detectHeader(rows, installers);
  const guessed = useMemo(() => guessTargets(rows, hasHeader, installers), [rows, hasHeader, installers]);
  const targets = targetOverride && targetOverride.length === guessed.length ? targetOverride : guessed;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const descIdx = targets.indexOf("description");
  const usable = descIdx === -1 ? [] : dataRows.filter((r) => (r[descIdx] ?? "").trim() !== "");
  const skipped = dataRows.length - usable.length;

  function setTarget(index: number, value: Target) {
    const next = [...targets];
    // A field can only come from one column.
    if (value !== "ignore") {
      for (let i = 0; i < next.length; i++) if (next[i] === value) next[i] = "ignore";
    }
    next[index] = value;
    setTargetOverride(next);
  }

  function submit() {
    const items: PastedItem[] = usable.map((r) => {
      const item: PastedItem = { code: "", description: "", salePrice: "", bucketDefault: "", costs: {} };
      targets.forEach((t, i) => {
        const cell = (r[i] ?? "").trim();
        if (t === "code") item.code = cell;
        else if (t === "description") item.description = cell;
        else if (t === "salePrice") item.salePrice = cell.replace(/[$,\s]/g, "");
        else if (t === "bucket") item.bucketDefault = normalizeBucket(cell);
        else if (t.startsWith("cost:") && cell) item.costs[t.slice(5)] = cell.replace(/[$,\s]/g, "");
      });
      return item;
    });
    onAdd(items);
  }

  const targetOptions: { value: Target; label: string }[] = [
    { value: "ignore", label: "Ignore" },
    { value: "description", label: "Description" },
    { value: "code", label: "Code" },
    { value: "salePrice", label: "Sale price" },
    { value: "bucket", label: "Bucket default" },
    ...installers.filter((i) => i.isActive).map((i) => ({ value: `cost:${i.id}`, label: `Cost - ${i.name}` })),
  ];

  const width = targets.length;
  return (
    <Modal
      wide
      title="Paste from Excel"
      description="Copy cells from a spreadsheet (Ctrl+C), paste them below, and check that each column is matched to the right field."
      onClose={onClose}
    >
      <div className="space-y-4">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setHeaderOverride(null);
            setTargetOverride(null);
          }}
          rows={6}
          placeholder={"Description\tSale price\nCrown Molding 96\"\t100\nDish Washer Panel\t90"}
          className={`${fieldClass} font-mono`}
        />

        {rows.length > 0 && (
          <>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => {
                  setHeaderOverride(e.target.checked);
                  setTargetOverride(null);
                }}
              />
              First row is a header
            </label>

            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    {Array.from({ length: width }, (_, i) => (
                      <th key={i} className="min-w-[150px] px-2 py-2 text-left">
                        <select
                          value={targets[i]}
                          onChange={(e) => setTarget(i, e.target.value)}
                          className={`${fieldClass} py-1.5 ${targets[i] === "ignore" ? "text-gray-400" : ""}`}
                          aria-label={`Column ${i + 1} is`}
                        >
                          {targetOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {dataRows.slice(0, 6).map((r, ri) => (
                    <tr key={ri}>
                      {Array.from({ length: width }, (_, ci) => (
                        <td
                          key={ci}
                          className={`px-3 py-1.5 ${targets[ci] === "ignore" ? "text-gray-400" : ""}`}
                        >
                          {r[ci] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dataRows.length > 6 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing the first 6 of {dataRows.length} rows.
              </p>
            )}
            {descIdx === -1 && (
              <p className="text-sm text-red-600">Pick which column is the Description.</p>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Rows are added to the table as unsaved. Codes you leave out are numbered automatically.
            {skipped > 0 && ` ${skipped} line${skipped === 1 ? "" : "s"} without a description will be skipped.`}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={secondaryButton}>
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={usable.length === 0} className={primaryButton}>
              Add {usable.length || ""} row{usable.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

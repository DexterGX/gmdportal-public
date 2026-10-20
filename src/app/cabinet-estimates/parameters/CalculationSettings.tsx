"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import type { CalcMode, Settings } from "./parameterTypes";
import { Notify, SectionCard, fieldClass, formatMoney, parseNumber, primaryButton, sameNumber } from "./parametersUi";

const CALC_MODE_OPTIONS: { value: CalcMode; label: string; description: string }[] = [
  {
    value: "higher",
    label: "Higher of the two (recommended)",
    description: "Uses whichever of the flat % or per-item calculation comes out bigger.",
  },
  {
    value: "flat",
    label: "Flat % of Cabinets only",
    description: "Always Installation Base % of the pre-discount Cabinets total.",
  },
  {
    value: "perItem",
    label: "Per-item (Installers Price Table) only",
    description: "Always the sum of each catalog-linked line's assigned Installers Price Table row x qty.",
  },
];

type Draft = {
  installationCalcMode: CalcMode;
  installationBasePercent: string;
  customSurchargePercent: string;
  costTaxPercent: string;
};

const toDraft = (s: Settings): Draft => ({
  installationCalcMode: s.installationCalcMode,
  installationBasePercent: String(s.installationBasePercent),
  customSurchargePercent: String(s.customSurchargePercent),
  costTaxPercent: String(s.costTaxPercent),
});

function PercentField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-800 dark:text-gray-200">{label}</label>
      <div className="flex max-w-[180px] items-center gap-2">
        <input
          value={value}
          inputMode="decimal"
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldClass} text-right`}
        />
        <span className="text-sm text-gray-400">%</span>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
    </div>
  );
}

export default function CalculationSettings({
  initial,
  notify,
}: {
  initial: Settings;
  notify: Notify;
}) {
  const [saved, setSaved] = useState<Settings>(initial);
  const [draft, setDraft] = useState<Draft>(toDraft(initial));
  const [saving, setSaving] = useState(false);

  const dirty =
    draft.installationCalcMode !== saved.installationCalcMode ||
    !sameNumber(draft.installationBasePercent, saved.installationBasePercent) ||
    !sameNumber(draft.customSurchargePercent, saved.customSurchargePercent) ||
    !sameNumber(draft.costTaxPercent, saved.costTaxPercent);

  async function save() {
    const next: Settings = {
      installationCalcMode: draft.installationCalcMode,
      installationBasePercent: parseNumber(draft.installationBasePercent),
      customSurchargePercent: parseNumber(draft.customSurchargePercent),
      costTaxPercent: parseNumber(draft.costTaxPercent),
    };
    if (
      next.installationBasePercent < 0 ||
      next.customSurchargePercent < 0 ||
      next.costTaxPercent < 0
    ) {
      notify("error", "Percentages can't be negative.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/cabinet-estimates/parameters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to save");
      setSaved(next);
      setDraft(toDraft(next));
      notify("success", "Calculation settings saved.");
    } catch (err: any) {
      notify("error", err?.message || "Failed to save calculation settings");
    } finally {
      setSaving(false);
    }
  }

  const base = parseNumber(draft.installationBasePercent);
  const example = (base / 100) * 10000;

  return (
    <SectionCard
      title="Calculation settings"
      description="The percentages behind the estimate form's Installation, Custom and cost-only (Preco de Custo) numbers."
      actions={
        <button type="button" onClick={() => void save()} disabled={!dirty || saving} className={primaryButton}>
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : dirty ? "Save settings" : "Saved"}
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-200">
            How Installation is calculated
          </div>
          <div className="space-y-2">
            {CALC_MODE_OPTIONS.map((opt) => {
              const selected = draft.installationCalcMode === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                    selected
                      ? "border-teal-500 bg-teal-50 dark:border-teal-600 dark:bg-teal-950/30"
                      : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="calcMode"
                    checked={selected}
                    onChange={() => setDraft((d) => ({ ...d, installationCalcMode: opt.value }))}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{opt.label}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{opt.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <PercentField
            label="Installation Base %"
            hint={`Applied to the Cabinets total before discount. Example: on $10,000 of cabinets the flat method gives ${formatMoney(
              example,
            )} (then multiplied by the Installation Type).`}
            value={draft.installationBasePercent}
            onChange={(v) => setDraft((d) => ({ ...d, installationBasePercent: v }))}
          />
          <PercentField
            label="Custom Surcharge %"
            hint="Added to Installation for every line with the Custom checkbox checked, as a % of that line's own qty x unit price."
            value={draft.customSurchargePercent}
            onChange={(v) => setDraft((d) => ({ ...d, customSurchargePercent: v }))}
          />
          <PercentField
            label="Preco de Custo tax %"
            hint="Tax row of the cost-only view and print, applied to Cabinets (cost). 0 = not set."
            value={draft.costTaxPercent}
            onChange={(v) => setDraft((d) => ({ ...d, costTaxPercent: v }))}
          />
        </div>
      </div>
    </SectionCard>
  );
}

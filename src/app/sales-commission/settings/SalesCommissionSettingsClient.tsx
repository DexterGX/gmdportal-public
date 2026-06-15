"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

type SalesRepSetting = {
  id?: string;
  displayName: string;
  quickbooksInitials: string;
  active: boolean;
  defaultCommissionRate?: string | number | null;
  notes?: string | null;
};

type NoteOption = {
  id?: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
};

type SettingsState = {
  firstCommissionPercent: number;
  secondCommissionPercent: number;
  minimumWeeklyPay: number;
  monthlyBonusSalesTarget: number;
  monthlyBonusAmount: number;
  payWeekStartDay: number;
  payWeekEndDay: number;
  checkDateRule: string;
};

const weekdayOptions = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export default function SalesCommissionSettingsClient() {
  const [settings, setSettings] = useState<SettingsState>({
    firstCommissionPercent: 60,
    secondCommissionPercent: 40,
    minimumWeeklyPay: 560,
    monthlyBonusSalesTarget: 200000,
    monthlyBonusAmount: 2500,
    payWeekStartDay: 5,
    payWeekEndDay: 4,
    checkDateRule: "SECOND_MONDAY_AFTER_PERIOD_END",
  });
  const [salesReps, setSalesReps] = useState<SalesRepSetting[]>([]);
  const [noteOptions, setNoteOptions] = useState<NoteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const response = await fetch("/api/sales-commission/settings");
    const body = await response.json();

    if (response.ok) {
      setSettings({
        firstCommissionPercent: Number(
          body.settings?.firstCommissionPercent || 60,
        ),
        secondCommissionPercent: Number(
          body.settings?.secondCommissionPercent || 40,
        ),
        minimumWeeklyPay: Number(body.settings?.minimumWeeklyPay || 560),
        monthlyBonusSalesTarget: Number(
          body.settings?.monthlyBonusSalesTarget || 200000,
        ),
        monthlyBonusAmount: Number(body.settings?.monthlyBonusAmount || 2500),
        payWeekStartDay: Number(body.settings?.payWeekStartDay || 5),
        payWeekEndDay: Number(body.settings?.payWeekEndDay || 4),
        checkDateRule: String(
          body.settings?.checkDateRule || "SECOND_MONDAY_AFTER_PERIOD_END",
        ),
      });
      setSalesReps(body.salesReps || []);
      setNoteOptions(body.noteOptions || []);
      setMessage(null);
    } else {
      setMessage(body.error || "Failed to load settings.");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function saveAll() {
    setSaving(true);
    const response = await fetch("/api/sales-commission/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings, salesReps, noteOptions }),
    });

    const body = await response.json();
    if (response.ok) {
      setMessage("Settings saved.");
      setSalesReps(body.salesReps || []);
      setNoteOptions(body.noteOptions || []);
    } else {
      setMessage(body.error || "Failed to save settings.");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Sales Commission Settings
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Configure commission split, minimum pay, monthly bonus rules, sales
          reps, and note options.
        </p>
      </div>

      {message && (
        <div className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-700 dark:text-gray-300">
          {message}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Commission Configuration
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <label className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <span>1st Commission %</span>
            <input
              type="number"
              step="0.01"
              value={settings.firstCommissionPercent}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  firstCommissionPercent: Number(e.target.value || 0),
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <span>2nd Commission %</span>
            <input
              type="number"
              step="0.01"
              value={settings.secondCommissionPercent}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  secondCommissionPercent: Number(e.target.value || 0),
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <span>Minimum Weekly Pay</span>
            <input
              type="number"
              step="0.01"
              value={settings.minimumWeeklyPay}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  minimumWeeklyPay: Number(e.target.value || 0),
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <span>Monthly Bonus Target</span>
            <input
              type="number"
              step="0.01"
              value={settings.monthlyBonusSalesTarget}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  monthlyBonusSalesTarget: Number(e.target.value || 0),
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <span>Monthly Bonus Amount</span>
            <input
              type="number"
              step="0.01"
              value={settings.monthlyBonusAmount}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  monthlyBonusAmount: Number(e.target.value || 0),
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <span>Pay Week Start Day</span>
            <select
              value={settings.payWeekStartDay}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  payWeekStartDay: Number(e.target.value),
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            >
              {weekdayOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <span>Pay Week End Day</span>
            <select
              value={settings.payWeekEndDay}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  payWeekEndDay: Number(e.target.value),
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            >
              {weekdayOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <span>Check Date Rule</span>
            <select
              value={settings.checkDateRule}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  checkDateRule: e.target.value,
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            >
              <option value="SECOND_MONDAY_AFTER_PERIOD_END">
                Second Monday after period end
              </option>
            </select>
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Sales Rep Mapping
          </h2>
          <button
            type="button"
            onClick={() =>
              setSalesReps((prev) => [
                ...prev,
                {
                  displayName: "",
                  quickbooksInitials: "",
                  active: true,
                  defaultCommissionRate: "",
                  notes: "",
                },
              ])
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-xs hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Sales Rep
          </button>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {[
                  "Display Name",
                  "QB Initials",
                  "Default Rate %",
                  "Active",
                  "Notes",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {salesReps.map((rep, idx) => (
                <tr
                  key={`${rep.id || "new"}-${idx}`}
                  className="border-b border-gray-100 dark:border-gray-700"
                >
                  <td className="px-3 py-2">
                    <input
                      value={rep.displayName}
                      onChange={(e) =>
                        setSalesReps((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, displayName: e.target.value }
                              : item,
                          ),
                        )
                      }
                      className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={rep.quickbooksInitials}
                      onChange={(e) =>
                        setSalesReps((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, quickbooksInitials: e.target.value }
                              : item,
                          ),
                        )
                      }
                      className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={rep.defaultCommissionRate ?? ""}
                      onChange={(e) =>
                        setSalesReps((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? {
                                  ...item,
                                  defaultCommissionRate: e.target.value,
                                }
                              : item,
                          ),
                        )
                      }
                      className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={rep.active}
                      onChange={(e) =>
                        setSalesReps((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, active: e.target.checked }
                              : item,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={rep.notes || ""}
                      onChange={(e) =>
                        setSalesReps((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, notes: e.target.value }
                              : item,
                          ),
                        )
                      }
                      className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {!rep.id && (
                      <button
                        type="button"
                        onClick={() =>
                          setSalesReps((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-300 text-red-600 text-xs hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Notes Options
          </h2>
          <button
            type="button"
            onClick={() =>
              setNoteOptions((prev) => [
                ...prev,
                { label: "", isActive: true, sortOrder: prev.length + 1 },
              ])
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-xs hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Note Option
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {noteOptions.map((option, idx) => (
            <div
              key={`${option.id || "new"}-${idx}`}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2"
            >
              <input
                value={option.label}
                onChange={(e) =>
                  setNoteOptions((prev) =>
                    prev.map((item, i) =>
                      i === idx ? { ...item, label: e.target.value } : item,
                    ),
                  )
                }
                placeholder="Note label"
                className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
              />
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={option.isActive}
                    onChange={(e) =>
                      setNoteOptions((prev) =>
                        prev.map((item, i) =>
                          i === idx
                            ? { ...item, isActive: e.target.checked }
                            : item,
                        ),
                      )
                    }
                  />
                  Active
                </label>
                <input
                  type="number"
                  value={option.sortOrder}
                  onChange={(e) =>
                    setNoteOptions((prev) =>
                      prev.map((item, i) =>
                        i === idx
                          ? { ...item, sortOrder: Number(e.target.value || 0) }
                          : item,
                      ),
                    )
                  }
                  className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={saveAll}
        disabled={saving || loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700 disabled:opacity-60"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        Save Settings
      </button>
    </div>
  );
}

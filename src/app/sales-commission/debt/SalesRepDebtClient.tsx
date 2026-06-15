"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";

type DebtRow = {
  id: string;
  salesRepId: string;
  periodId: string | null;
  type: "DEBT_ADDED" | "DEBT_DEDUCTED" | "MANUAL_ADJUSTMENT";
  amount: string;
  previousBalance: string;
  newBalance: string;
  notes: string | null;
  createdAt: string;
  salesRep: { id: string; displayName: string };
  period: { id: string; startDate: string; endDate: string } | null;
};

type SalesRep = {
  id: string;
  displayName: string;
  active: boolean;
};

export default function SalesRepDebtClient() {
  const [rows, setRows] = useState<DebtRow[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [salesRepId, setSalesRepId] = useState("");
  const [type, setType] = useState<DebtRow["type"]>("MANUAL_ADJUSTMENT");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const balancesByRep = useMemo(() => {
    const map = new Map<string, number>();
    rows
      .slice()
      .reverse()
      .forEach((row) => {
        if (!map.has(row.salesRepId)) {
          map.set(row.salesRepId, Number(row.newBalance));
        }
      });
    return map;
  }, [rows]);

  async function loadData() {
    setLoading(true);
    try {
      const [settingsRes, debtRes] = await Promise.all([
        fetch("/api/sales-commission/settings"),
        fetch("/api/sales-commission/debt-ledger"),
      ]);

      const settingsData = await settingsRes.json();
      const debtData = await debtRes.json();

      if (!settingsRes.ok) {
        throw new Error(settingsData.error || "Failed to load sales reps");
      }
      if (!debtRes.ok) {
        throw new Error(debtData.error || "Failed to load debt ledger");
      }

      setSalesReps(
        (settingsData.salesReps || []).filter((rep: SalesRep) => rep.active),
      );
      setRows(debtData.rows || []);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load debt data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addEntry() {
    if (!salesRepId || !amount) {
      setMessage("Sales rep and amount are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/sales-commission/debt-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesRepId,
          type,
          amount,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add debt entry");
      }

      setAmount("");
      setNotes("");
      setMessage("Debt ledger entry added.");
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "Failed to add debt entry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Sales Rep Debt
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Track debt added/deducted and manual balance adjustments for minimum
          pay.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Add Ledger Entry
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            value={salesRepId}
            onChange={(e) => setSalesRepId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
          >
            <option value="">Select sales rep</option>
            {salesReps.map((rep) => (
              <option key={rep.id} value={rep.id}>
                {rep.displayName}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DebtRow["type"])}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
          >
            <option value="DEBT_ADDED">Debt Added</option>
            <option value="DEBT_DEDUCTED">Debt Deducted</option>
            <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
          </select>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={addEntry}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700"
        >
          <Plus className="w-4 h-4" />
          Add Entry
        </button>
      </div>

      {message && (
        <div className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-700 dark:text-gray-300">
          {message}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
          Current Debt by Sales Rep
        </h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {Array.from(balancesByRep.entries()).map(([repId, balance]) => {
            const rep = salesReps.find((row) => row.id === repId);
            return (
              <span
                key={repId}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1"
              >
                {rep?.displayName || repId}: ${balance.toFixed(2)}
              </span>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              {[
                "Date",
                "Sales Rep",
                "Period",
                "Type",
                "Amount",
                "Previous",
                "New",
                "Notes",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-gray-100 dark:border-gray-700"
              >
                <td className="px-4 py-3">
                  {new Date(row.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {row.salesRep?.displayName || "-"}
                </td>
                <td className="px-4 py-3">
                  {row.period
                    ? `${new Date(row.period.startDate).toLocaleDateString()} - ${new Date(row.period.endDate).toLocaleDateString()}`
                    : "-"}
                </td>
                <td className="px-4 py-3">{row.type}</td>
                <td className="px-4 py-3">${Number(row.amount).toFixed(2)}</td>
                <td className="px-4 py-3">
                  ${Number(row.previousBalance).toFixed(2)}
                </td>
                <td className="px-4 py-3 font-medium">
                  ${Number(row.newBalance).toFixed(2)}
                </td>
                <td className="px-4 py-3">{row.notes || "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-gray-500 text-sm"
                >
                  No debt ledger entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="inline-flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      )}
    </div>
  );
}

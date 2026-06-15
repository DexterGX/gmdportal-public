"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { CommissionPeriod } from "../types";

const statusStyles: Record<CommissionPeriod["status"], string> = {
  DRAFT: "bg-blue-100 text-blue-700 border-blue-200",
  REVIEWED: "bg-amber-100 text-amber-700 border-amber-200",
  FINALIZED: "bg-green-100 text-green-700 border-green-200",
  REOPENED: "bg-orange-100 text-orange-700 border-orange-200",
};

function money(value: unknown) {
  const n = Number(value || 0);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function displayDateOnly(value: string | Date | null | undefined) {
  if (!value) return "-";
  const raw = value instanceof Date ? value : String(value).trim();
  if (!raw) return "-";

  const match =
    typeof raw === "string"
      ? raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/)
      : null;
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(raw);

  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
}

function localDateInputValue(dateValue: Date) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CommissionPeriodsClient({
  appRole,
}: {
  appRole: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<CommissionPeriod[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    localDateInputValue(new Date()),
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadRows() {
    setLoading(true);
    const res = await fetch("/api/sales-commission/periods");
    const data = await res.json();
    if (res.ok) {
      setRows(data.periods || []);
    } else {
      setMessage(data.error || "Failed to load weekly commissions.");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadRows();
  }, []);

  async function createPeriod() {
    setLoading(true);
    const res = await fetch("/api/sales-commission/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedDate, salesRepScope: "ALL" }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(
        data.existed
          ? "Weekly commission already existed."
          : "Weekly commission draft created.",
      );
      await loadRows();
    } else {
      setMessage(data.error || "Failed to create weekly commission.");
    }
    setLoading(false);
  }

  async function updateStatus(
    periodId: string,
    status: CommissionPeriod["status"],
  ) {
    let reopenReason = "";
    if (status === "REOPENED") {
      reopenReason =
        prompt(
          "Why are you reopening this finalized weekly commission?",
        )?.trim() || "";
      if (!reopenReason) {
        setMessage("Reopen reason is required.");
        return;
      }
    }

    setLoading(true);
    const res = await fetch("/api/sales-commission/periods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodId, status, reopenReason }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Weekly commission updated to ${status}.`);
      await loadRows();
    } else {
      setMessage(data.error || "Failed to update weekly commission.");
    }
    setLoading(false);
  }

  async function deleteDraft(periodId: string) {
    if (
      !confirm(
        "Delete this draft weekly commission? This does not delete master invoices.",
      )
    ) {
      return;
    }

    setLoading(true);
    const res = await fetch(
      `/api/sales-commission/periods?periodId=${encodeURIComponent(periodId)}`,
      {
        method: "DELETE",
      },
    );
    const data = await res.json();
    if (res.ok) {
      setMessage("Draft deleted.");
      await loadRows();
    } else {
      setMessage(data.error || "Failed to delete draft.");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Saved Weekly Commissions
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Weekly commission drafts and finalized payroll snapshots.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-sm outline-none"
          />
        </div>
        <button
          type="button"
          onClick={createPeriod}
          className="px-3 py-2 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700"
        >
          Resolve/Create Weekly Draft
        </button>
      </div>

      {message && (
        <div className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-700 dark:text-gray-300">
          {message}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-auto">
        <table className="w-full min-w-[1260px] text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              {[
                "Pay Period",
                "Check Date",
                "Sales Rep Scope",
                "Status",
                "Invoice Count",
                "1st Payments",
                "2nd Payments",
                "Bonus",
                "Debt Added",
                "Debt Deducted",
                "Final Payroll",
                "Last Updated",
                "Actions",
              ].map((header) => (
                <th
                  key={header}
                  className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isDraft = row.status === "DRAFT";
              const isReviewed = row.status === "REVIEWED";
              const isFinalized = row.status === "FINALIZED";

              return (
                <tr
                  key={row.id}
                  className="border-b border-gray-100 dark:border-gray-700"
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    {displayDateOnly(row.startDate)} -{" "}
                    {displayDateOnly(row.endDate)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {displayDateOnly(row.checkDate)}
                  </td>
                  <td className="px-3 py-2">{row.salesRepScope || "ALL"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusStyles[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{row._count?.invoices ?? 0}</td>
                  <td className="px-3 py-2">
                    {money((row as any).totalFirstPayments)}
                  </td>
                  <td className="px-3 py-2">
                    {money((row as any).totalSecondPayments)}
                  </td>
                  <td className="px-3 py-2">
                    {money((row as any).totalBonus)}
                  </td>
                  <td className="px-3 py-2 text-red-600">
                    {money((row as any).totalDebtAdded)}
                  </td>
                  <td className="px-3 py-2 text-green-700">
                    {money((row as any).totalDebtDeducted)}
                  </td>
                  <td className="px-3 py-2 font-semibold">
                    {money((row as any).totalFinalPayroll)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(row.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/sales-commission?periodId=${row.id}`)
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 text-[11px] hover:bg-gray-50"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            `/api/sales-commission/export?periodId=${row.id}&includeClosed=1`,
                            "_blank",
                          )
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 text-[11px] hover:bg-gray-50"
                      >
                        Export
                      </button>

                      {isDraft && (
                        <button
                          type="button"
                          onClick={() => updateStatus(row.id, "REVIEWED")}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-blue-300 text-blue-700 text-[11px] hover:bg-blue-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Reviewed
                        </button>
                      )}

                      {(isDraft || isReviewed || row.status === "REOPENED") && (
                        <button
                          type="button"
                          onClick={() => updateStatus(row.id, "FINALIZED")}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-green-300 text-green-700 text-[11px] hover:bg-green-50"
                        >
                          Finalize
                        </button>
                      )}

                      {isReviewed && (
                        <button
                          type="button"
                          onClick={() => updateStatus(row.id, "DRAFT")}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 text-gray-700 text-[11px] hover:bg-gray-50"
                        >
                          Return Draft
                        </button>
                      )}

                      {isFinalized && appRole === "admin" && (
                        <button
                          type="button"
                          onClick={() => updateStatus(row.id, "REOPENED")}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-orange-300 text-orange-700 text-[11px] hover:bg-orange-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reopen
                        </button>
                      )}

                      {isDraft && appRole === "admin" && (
                        <button
                          type="button"
                          onClick={() => deleteDraft(row.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-300 text-red-600 text-[11px] hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete Draft
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={13}
                  className="px-4 py-10 text-center text-gray-500 text-sm"
                >
                  No saved weekly commissions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="inline-flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Working...
        </div>
      )}
    </div>
  );
}

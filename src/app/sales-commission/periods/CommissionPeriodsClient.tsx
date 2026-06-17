"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Download, FileText, Pencil, Trash2 } from "lucide-react";
import { CMSWeek, formatCurrency, formatDate } from "../types";

export default function CommissionPeriodsClient({
  weeks,
}: {
  weeks: CMSWeek[];
}) {
  const router = useRouter();
  const [weeksState, setWeeksState] = useState<CMSWeek[]>(weeks);
  const [selectedReps, setSelectedReps] = useState<Record<string, string>>({});

  const downloadWeek = (week: CMSWeek, rep?: string) => {
    const rows = (week.invoices ?? [])
      .filter((row) => !rep || row.salesRep === rep)
      .map((row) => ({
        "Sales Rep": row.salesRep,
        Date: row.invoiceDate,
        "Invoice#": row.invoiceNumber,
        Customer: row.customer,
        "% Cms": row.commissionRate,
        Amount: row.amount,
        Commission: row.calculatedCommission,
        "1st Payment": row.firstPaymentAmount,
        "2nd Payment": row.secondPaymentAmount,
        Status: row.status,
        Notes: row.notes ?? "",
      }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Commission");
    const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commission-${week.weekStart.slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteWeek = async (week: CMSWeek) => {
    const ok = window.confirm(
      `Delete week ${formatDate(week.weekStart)} - ${formatDate(week.weekEnd)}? This cannot be undone.`,
    );
    if (!ok) return;

    const res = await fetch(
      `/api/sales-commission/weeks?id=${encodeURIComponent(week.id)}`,
      {
        method: "DELETE",
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(body?.error ?? "Failed to delete week.");
      return;
    }

    setWeeksState((prev) => prev.filter((w) => w.id !== week.id));
  };

  const handleEditWeek = async (week: CMSWeek) => {
    // Reopen/ensure draft mode, then route back to main editor.
    await fetch("/api/sales-commission/weeks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: week.id, status: "DRAFT" }),
    });
    router.push("/sales-commission");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-gray-500">
          Commission Periods
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-gray-900">
          Recorded weeks
        </h1>
        <div className="mt-4">
          <Link
            href="/sales-commission"
            className="rounded-full border px-4 py-2 text-sm"
          >
            Back to current week
          </Link>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {weeksState.map((week) => (
          <div
            key={week.id}
            className="rounded-3xl border bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  {formatDate(week.weekStart)} - {formatDate(week.weekEnd)}
                </h2>
                <p className="text-sm text-gray-600">
                  Check date: {formatDate(week.checkDate)} · {week.status}
                </p>
              </div>
              <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                {week.status}
              </div>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-gray-700">
              <p>Total invoices: {week.invoices?.length ?? 0}</p>
              <p>
                Total commission:{" "}
                {formatCurrency(
                  (week.invoices ?? []).reduce(
                    (sum, row) => sum + Number(row.calculatedCommission || 0),
                    0,
                  ),
                )}
              </p>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Download by sales rep
              </label>
              <select
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm"
                value={
                  selectedReps[week.id] ?? week.invoices?.[0]?.salesRep ?? ""
                }
                onChange={(e) =>
                  setSelectedReps((prev) => ({
                    ...prev,
                    [week.id]: e.target.value,
                  }))
                }
              >
                {(
                  Array.from(
                    new Set((week.invoices ?? []).map((row) => row.salesRep)),
                  ).filter(Boolean) as string[]
                ).map((rep) => (
                  <option key={rep} value={rep}>
                    {rep}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => downloadWeek(week)}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm"
              >
                <Download className="h-4 w-4" /> Excel
              </button>
              <button
                onClick={() =>
                  downloadWeek(
                    week,
                    selectedReps[week.id] ?? week.invoices?.[0]?.salesRep,
                  )
                }
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm"
              >
                <FileText className="h-4 w-4" /> Selected Rep
              </button>
              {(week.status === "DRAFT" || week.status === "REVIEW") && (
                <button
                  onClick={() => handleEditWeek(week)}
                  className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              )}
              <button
                onClick={() => handleDeleteWeek(week)}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          </div>
        ))}
        {weeksState.length === 0 && (
          <div className="rounded-3xl border bg-white p-5 text-sm text-gray-500 shadow-sm">
            No recorded weeks.
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  CMSInvoice,
  CMSWeek,
  formatCurrency,
  formatDate,
  isBonusCustomerName,
} from "../types";

type Props = {
  weeks: CMSWeek[];
  initialUserName: string;
};

type Metrics = {
  totalInvoiceSales: number;
  totalSalesForMonth: number;
  totalCommission: number;
  totalCommissionLeft: number;
  commissionThisWeek: number;
  minWageComplement: number;
  bonus: number;
  finalWeekPay: number;
};

type WeekSummary = Metrics & {
  weekId: string;
  weekStart: string;
  weekEnd: string;
  checkDate: string;
  totalSalesForWeek: number;
};

const MIN_WEEKLY_PAY = 560;

function asNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toDateKey(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function isWithinMonth(
  dateValue: string,
  monthStart: Date,
  monthEnd: Date,
): boolean {
  const d = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  return d >= monthStart && d <= monthEnd;
}

function computeMetrics(
  invoices: CMSInvoice[],
  monthStart: Date,
  monthEnd: Date,
): Metrics {
  let totalInvoiceSales = 0;
  let totalSalesForMonth = 0;
  let totalCommission = 0;
  let commissionLeftBase = 0;
  let commissionThisWeek = 0;
  let bonus = 0;

  for (const invoice of invoices) {
    const invoiceAmount = asNum(invoice.amount);
    const totalCms = asNum(invoice.calculatedCommission);
    const firstPaymentAmount = asNum(invoice.firstPaymentAmount);
    const secondPaymentAmount = asNum(invoice.secondPaymentAmount);
    const isBonus = isBonusCustomerName(invoice.customer);

    if (isBonus) {
      bonus += invoiceAmount;
    } else {
      totalInvoiceSales += invoiceAmount;
      totalCommission += totalCms;

      if (isWithinMonth(toDateKey(invoice.invoiceDate), monthStart, monthEnd)) {
        totalSalesForMonth += invoiceAmount;
      }

      const unpaidFirst =
        invoice.firstPaid || invoice.firstPaidDate ? 0 : firstPaymentAmount;
      const unpaidSecond =
        invoice.secondPaid || invoice.secondPaidDate ? 0 : secondPaymentAmount;
      commissionLeftBase += unpaidFirst + unpaidSecond;

      const paidThisWeek =
        (invoice.payFirst ? firstPaymentAmount : 0) +
        (invoice.paySecond ? secondPaymentAmount : 0);
      commissionThisWeek += paidThisWeek;
    }
  }

  const totalCommissionLeft = Math.max(
    0,
    commissionLeftBase - commissionThisWeek,
  );
  const minWageComplement = Math.max(0, MIN_WEEKLY_PAY - commissionThisWeek);
  const finalWeekPay = commissionThisWeek + minWageComplement + bonus;

  return {
    totalInvoiceSales,
    totalSalesForMonth,
    totalCommission,
    totalCommissionLeft,
    commissionThisWeek,
    minWageComplement,
    bonus,
    finalWeekPay,
  };
}

export default function SalesRepStatusClient({
  weeks,
  initialUserName,
}: Props) {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const reps = useMemo(() => {
    const set = new Set<string>();
    for (const week of weeks) {
      for (const invoice of week.invoices ?? []) {
        const rep = (invoice.salesRep || "").trim();
        if (rep) set.add(rep);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [weeks]);

  const [selectedRep, setSelectedRep] = useState<string>("");

  const monthRange = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);
    return { start, end };
  }, [selectedMonth]);

  const monthLabel = useMemo(() => {
    return monthRange.start.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [monthRange]);

  const weeklyByRep = useMemo(() => {
    const map = new Map<string, WeekSummary[]>();

    for (const week of weeks) {
      const invoices = week.invoices ?? [];
      const repGroups = new Map<string, CMSInvoice[]>();

      for (const invoice of invoices) {
        const rep = (invoice.salesRep || "").trim() || "(unassigned)";
        const existing = repGroups.get(rep) ?? [];
        existing.push(invoice);
        repGroups.set(rep, existing);
      }

      for (const [rep, repInvoices] of repGroups.entries()) {
        const metrics = computeMetrics(
          repInvoices,
          monthRange.start,
          monthRange.end,
        );
        const row: WeekSummary = {
          weekId: week.id,
          weekStart: week.weekStart,
          weekEnd: week.weekEnd,
          checkDate: week.checkDate,
          totalSalesForWeek: metrics.totalInvoiceSales,
          ...metrics,
        };
        const repRows = map.get(rep) ?? [];
        repRows.push(row);
        map.set(rep, repRows);
      }
    }

    for (const value of map.values()) {
      value.sort(
        (a, b) =>
          new Date(b.checkDate).getTime() - new Date(a.checkDate).getTime(),
      );
    }

    return map;
  }, [weeks, monthRange]);

  const cardStats = useMemo(() => {
    return reps.map((rep) => {
      const rows = weeklyByRep.get(rep) ?? [];
      return {
        rep,
        totalSalesBrought: rows.reduce(
          (sum, row) => sum + row.totalInvoiceSales,
          0,
        ),
        totalCommissionsPaid: rows.reduce(
          (sum, row) => sum + row.commissionThisWeek,
          0,
        ),
        totalMinimumHelp: rows.reduce(
          (sum, row) => sum + row.minWageComplement,
          0,
        ),
      };
    });
  }, [reps, weeklyByRep]);

  const effectiveSelectedRep = selectedRep || reps[0] || "";

  const selectedRepMonthRows = useMemo(() => {
    if (!effectiveSelectedRep) return [];
    const rows = weeklyByRep.get(effectiveSelectedRep) ?? [];
    return rows.filter((row) => {
      const check = new Date(row.checkDate);
      return (
        check.getFullYear() === monthRange.start.getFullYear() &&
        check.getMonth() === monthRange.start.getMonth()
      );
    });
  }, [effectiveSelectedRep, weeklyByRep, monthRange]);

  const selectedRepMonthSummary = useMemo(() => {
    return selectedRepMonthRows.reduce<Metrics>(
      (acc, row) => ({
        totalInvoiceSales: acc.totalInvoiceSales + row.totalInvoiceSales,
        totalSalesForMonth: acc.totalSalesForMonth + row.totalSalesForMonth,
        totalCommission: acc.totalCommission + row.totalCommission,
        totalCommissionLeft: acc.totalCommissionLeft + row.totalCommissionLeft,
        commissionThisWeek: acc.commissionThisWeek + row.commissionThisWeek,
        minWageComplement: acc.minWageComplement + row.minWageComplement,
        bonus: acc.bonus + row.bonus,
        finalWeekPay: acc.finalWeekPay + row.finalWeekPay,
      }),
      {
        totalInvoiceSales: 0,
        totalSalesForMonth: 0,
        totalCommission: 0,
        totalCommissionLeft: 0,
        commissionThisWeek: 0,
        minWageComplement: 0,
        bonus: 0,
        finalWeekPay: 0,
      },
    );
  }, [selectedRepMonthRows]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-gray-500">
          Sales Commission
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-gray-900">
          Sales Rep Status
        </h1>
        <p className="mt-1 text-xs text-gray-600">
          Logged in as {initialUserName || "user"}. Click a rep card to view
          monthly week summaries.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-xs text-gray-600">
            <span className="mb-1 block">Month</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cardStats.map((card) => (
          <button
            key={card.rep}
            type="button"
            onClick={() => setSelectedRep(card.rep)}
            className={`rounded-2xl border p-4 text-left shadow-sm transition ${
              effectiveSelectedRep === card.rep
                ? "border-blue-300 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <p className="text-sm font-bold uppercase tracking-wide text-gray-800">
              {card.rep}
            </p>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Total Sales Brought</span>
                <strong className="text-gray-900">
                  {formatCurrency(card.totalSalesBrought)}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Total Commissions Paid</span>
                <strong className="text-gray-900">
                  {formatCurrency(card.totalCommissionsPaid)}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Minimum Paycheck Helped</span>
                <strong className="text-red-600">
                  {formatCurrency(card.totalMinimumHelp)}
                </strong>
              </div>
            </div>
          </button>
        ))}
      </div>

      {effectiveSelectedRep && (
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.28em] text-gray-500">
            Monthly Summary
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">
            {effectiveSelectedRep} · {monthLabel}
          </h2>

          <div className="mt-4 max-w-3xl rounded-xl border border-gray-200 bg-white p-4">
            <dl className="space-y-1.5 text-xs">
              <div className="grid grid-cols-[220px_auto] items-center gap-4 border-b pb-1">
                <dt className="text-gray-500">Total Invoice Sales</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(selectedRepMonthSummary.totalInvoiceSales)}
                </dd>
              </div>
              <div className="grid grid-cols-[220px_auto] items-center gap-4 border-b pb-1">
                <dt className="text-gray-500">Total Sales for {monthLabel}</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(selectedRepMonthSummary.totalSalesForMonth)}
                </dd>
              </div>
              <div className="grid grid-cols-[220px_auto] items-center gap-4 border-b pb-1">
                <dt className="text-gray-500">Total Commission</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(selectedRepMonthSummary.totalCommission)}
                </dd>
              </div>
              <div className="grid grid-cols-[220px_auto] items-center gap-4 border-b pb-1">
                <dt className="text-gray-500">Commission for This Week</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(selectedRepMonthSummary.commissionThisWeek)}
                </dd>
              </div>
              <div className="grid grid-cols-[220px_auto] items-center gap-4 border-b pb-1">
                <dt className="text-gray-500">
                  Complement to reach Min Wage by Law
                </dt>
                <dd className="font-medium text-red-600">
                  {formatCurrency(selectedRepMonthSummary.minWageComplement)}
                </dd>
              </div>
              <div className="grid grid-cols-[220px_auto] items-center gap-4 border-b pb-1">
                <dt className="text-gray-500">Bonus</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(selectedRepMonthSummary.bonus)}
                </dd>
              </div>
              <div className="grid grid-cols-[220px_auto] items-center gap-4 pt-1">
                <dt className="font-semibold text-gray-800">Final Week Pay</dt>
                <dd className="font-bold text-emerald-700">
                  {formatCurrency(selectedRepMonthSummary.finalWeekPay)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-gray-100 text-left text-xs uppercase tracking-[0.2em] text-gray-600">
                <tr>
                  <th className="border border-gray-200 px-3 py-3">Week</th>
                  <th className="border border-gray-200 px-3 py-3">
                    Check Date
                  </th>
                  <th className="border border-gray-200 px-3 py-3">
                    Total Sales for Week
                  </th>
                  <th className="border border-gray-200 px-3 py-3">
                    Total Invoice Sales
                  </th>
                  <th className="border border-gray-200 px-3 py-3">
                    Total Commission
                  </th>
                  <th className="border border-gray-200 px-3 py-3">
                    Commission for This Week
                  </th>
                  <th className="border border-gray-200 px-3 py-3">
                    Min Wage Complement
                  </th>
                  <th className="border border-gray-200 px-3 py-3">Bonus</th>
                  <th className="border border-gray-200 px-3 py-3">
                    Final Week Pay
                  </th>
                </tr>
              </thead>
              <tbody>
                {selectedRepMonthRows.map((row) => (
                  <tr key={row.weekId}>
                    <td className="border border-gray-200 px-3 py-2">
                      {formatDate(row.weekStart)} - {formatDate(row.weekEnd)}
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      {formatDate(row.checkDate)}
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      {formatCurrency(row.totalSalesForWeek)}
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      {formatCurrency(row.totalInvoiceSales)}
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      {formatCurrency(row.totalCommission)}
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      {formatCurrency(row.commissionThisWeek)}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 font-semibold text-red-600">
                      {formatCurrency(row.minWageComplement)}
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      {formatCurrency(row.bonus)}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 font-semibold text-emerald-700">
                      {formatCurrency(row.finalWeekPay)}
                    </td>
                  </tr>
                ))}
                {selectedRepMonthRows.length === 0 && (
                  <tr>
                    <td
                      className="border border-gray-200 px-3 py-4 text-sm text-gray-500"
                      colSpan={9}
                    >
                      No weekly summaries for {effectiveSelectedRep} in{" "}
                      {monthLabel}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

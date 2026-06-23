"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { Download, Eye } from "lucide-react";
import { CMSClosedInvoice, formatCurrency, formatDate } from "../types";

export default function ClosedInvoicesClient({
  invoices,
}: {
  invoices: CMSClosedInvoice[];
}) {
  const [repFilter, setRepFilter] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("");
  const [viewingRowId, setViewingRowId] = useState<string | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);

  const toDateKey = (value: string | Date | null | undefined): string => {
    if (!value) return "";
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  };

  const openWeekInNewTab = async (row: CMSClosedInvoice) => {
    setViewError(null);
    setViewingRowId(row.id);
    try {
      const res = await fetch("/api/sales-commission/weeks?status=APPROVED", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Unable to load weeks.");

      const target = Array.isArray(data)
        ? data.find((week: any) => {
            return (
              toDateKey(week.weekStart) === toDateKey(row.weekStart) &&
              toDateKey(week.weekEnd) === toDateKey(row.weekEnd) &&
              toDateKey(week.checkDate) === toDateKey(row.checkDate)
            );
          })
        : null;

      if (!target?.id) {
        setViewError("Could not find the original week for this invoice.");
        return;
      }

      window.open(
        `/sales-commission?viewWeekId=${target.id}`,
        "_blank",
        "noopener,noreferrer",
      );
    } catch (error: any) {
      setViewError(error?.message ?? "Unable to open the week view.");
    } finally {
      setViewingRowId(null);
    }
  };

  const filtered = useMemo(() => {
    return invoices.filter((row) => {
      if (
        repFilter &&
        !row.salesRep.toLowerCase().includes(repFilter.toLowerCase())
      )
        return false;
      if (
        invoiceFilter &&
        !row.invoiceNumber.toLowerCase().includes(invoiceFilter.toLowerCase())
      )
        return false;
      return true;
    });
  }, [invoices, repFilter, invoiceFilter]);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filtered.map((row) => ({
        "Sales Rep": row.salesRep,
        Date: row.invoiceDate,
        "Invoice#": row.invoiceNumber,
        Customer: row.customer,
        "%CMS": row.commissionRate,
        Amount: row.amount,
        Commission: row.calculatedCommission,
        "1st Payment": row.firstPaymentAmount,
        "1st Paid Date": row.firstPaidDate ?? "",
        "2nd Payment": row.secondPaymentAmount,
        "2nd Paid Date": row.secondPaidDate ?? "",
        Notes: row.notes ?? "",
        "Closed At": row.closedAt,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Closed");
    const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "closed-invoices.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-gray-500">
          Closed Invoices
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-gray-900">
          Records list
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/sales-commission"
            className="rounded-full border px-4 py-2 text-sm"
          >
            Current
          </Link>
          <Link
            href="/sales-commission/periods"
            className="rounded-full border px-4 py-2 text-sm"
          >
            Periods
          </Link>
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm"
          >
            <Download className="h-4 w-4" /> Export Excel
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={repFilter}
            onChange={(e) => setRepFilter(e.target.value)}
            className="rounded-2xl border px-4 py-3"
            placeholder="Sales Rep filter"
          />
          <input
            value={invoiceFilter}
            onChange={(e) => setInvoiceFilter(e.target.value)}
            className="rounded-2xl border px-4 py-3"
            placeholder="Invoice# filter"
          />
        </div>
        {viewError && <p className="mt-3 text-sm text-red-600">{viewError}</p>}
      </div>
      <div className="overflow-x-auto rounded-3xl border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-[11px]">
          <colgroup>
            <col style={{ width: "6%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "6%" }} />
          </colgroup>
          <thead className="bg-gray-100 text-[9px] uppercase tracking-[0.16em] text-gray-600">
            <tr>
              <th className="border-r px-2 py-2.5 text-center">Sales Rep</th>
              <th className="border-r px-2 py-2.5 text-center">Invoice#</th>
              <th className="border-r px-2 py-2.5 text-center">Customer</th>
              <th className="border-r px-2 py-2.5 text-center">% Cms</th>
              <th className="border-r px-2 py-2.5 text-center">Amount</th>
              <th className="border-r px-2 py-2.5 text-center">Total Cms</th>
              <th className="border-r px-2 py-2.5 text-center">1st Payment</th>
              <th className="border-r px-2 py-2.5 text-center">1st Paid</th>
              <th className="border-r px-2 py-2.5 text-center">2nd Payment</th>
              <th className="border-r px-2 py-2.5 text-center">2nd Paid</th>
              <th className="border-r px-2 py-2.5 text-center">Closed</th>
              <th className="px-2 py-2.5 text-center">Open</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.id}
                className="divide-x divide-gray-200 border-t align-top"
              >
                <td className="px-2 py-1.5">
                  <div className="w-16 rounded-md border bg-white px-2 py-1 text-[11px]">
                    {row.salesRep}
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <div className="w-[76px] rounded-md border bg-white px-1.5 py-1 text-[11px]">
                      {row.invoiceNumber}
                    </div>
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <div className="w-[220px] rounded-md border bg-white px-2 py-1 text-[11px]">
                    {row.customer}
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center rounded-md border bg-white overflow-hidden w-[58px]">
                    <div className="w-9 px-1.5 py-1 text-[11px]">
                      {row.commissionRate}
                    </div>
                    <span className="border-l px-1.5 py-1 text-[11px] text-gray-500 bg-gray-50">
                      %
                    </span>
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center rounded-md border bg-white overflow-hidden w-[92px]">
                    <span className="border-r px-1.5 py-1 text-[11px] text-gray-500 bg-gray-50">
                      $
                    </span>
                    <div className="px-1.5 py-1 text-[11px]">
                      {Number(row.amount).toFixed(2)}
                    </div>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-center font-medium">
                  {formatCurrency(Number(row.calculatedCommission))}
                </td>
                <td className="px-2 py-1.5 text-center">
                  <div className="font-medium">
                    {formatCurrency(Number(row.firstPaymentAmount))}
                  </div>
                </td>
                <td className="px-2 py-1.5 text-center">
                  {formatDate(row.firstPaidDate)}
                </td>
                <td className="px-2 py-1.5 text-center">
                  <div className="font-medium">
                    {formatCurrency(Number(row.secondPaymentAmount))}
                  </div>
                </td>
                <td className="px-2 py-1.5 text-center">
                  {formatDate(row.secondPaidDate)}
                </td>
                <td className="px-2 py-1.5 text-center">
                  {formatDate(row.closedAt)}
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    type="button"
                    onClick={() => openWeekInNewTab(row)}
                    disabled={viewingRowId === row.id}
                    className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs disabled:opacity-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {viewingRowId === row.id ? "Opening..." : "View"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

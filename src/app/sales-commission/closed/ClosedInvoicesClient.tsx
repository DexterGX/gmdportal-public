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
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-xs uppercase tracking-[0.2em] text-gray-600">
            <tr>
              <th className="px-3 py-3">Rep</th>
              <th className="px-3 py-3">Invoice#</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">%CMS</th>
              <th className="px-3 py-3">Amount</th>
              <th className="px-3 py-3">Commission</th>
              <th className="px-3 py-3">1st Payment</th>
              <th className="px-3 py-3">1st Paid</th>
              <th className="px-3 py-3">2nd Payment</th>
              <th className="px-3 py-3">2nd Paid</th>
              <th className="px-3 py-3">Closed</th>
              <th className="px-3 py-3">Open</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">{row.salesRep}</td>
                <td className="px-3 py-2">{row.invoiceNumber}</td>
                <td className="px-3 py-2">{row.customer}</td>
                <td className="px-3 py-2">{row.commissionRate}%</td>
                <td className="px-3 py-2">
                  {formatCurrency(Number(row.amount))}
                </td>
                <td className="px-3 py-2">
                  {formatCurrency(Number(row.calculatedCommission))}
                </td>
                <td className="px-3 py-2">
                  {formatCurrency(Number(row.firstPaymentAmount))}
                </td>
                <td className="px-3 py-2">{formatDate(row.firstPaidDate)}</td>
                <td className="px-3 py-2">
                  {formatCurrency(Number(row.secondPaymentAmount))}
                </td>
                <td className="px-3 py-2">{formatDate(row.secondPaidDate)}</td>
                <td className="px-3 py-2">{formatDate(row.closedAt)}</td>
                <td className="px-3 py-2">
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

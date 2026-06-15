"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw, ExternalLink } from "lucide-react";
import type { CommissionInvoice, CommissionPeriod } from "../types";

function qbUrl(txnId: string | null | undefined) {
  const id = String(txnId || "").trim();
  return id
    ? `https://qbo.intuit.com/app/invoice?txnId=${encodeURIComponent(id)}`
    : "";
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

export default function ClosedInvoicesClient({ appRole }: { appRole: string }) {
  const [rows, setRows] = useState<CommissionInvoice[]>([]);
  const [periods, setPeriods] = useState<CommissionPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [client, setClient] = useState("");
  const [invoice, setInvoice] = useState("");
  const [salesRep, setSalesRep] = useState("");
  const [checkDate, setCheckDate] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function loadPeriods() {
    const res = await fetch("/api/sales-commission/periods");
    const data = await res.json();
    if (res.ok) {
      setPeriods(data.periods || []);
    }
  }

  async function loadRows() {
    setLoading(true);
    const params = new URLSearchParams();
    if (client) params.set("client", client);
    if (invoice) params.set("invoice", invoice);
    if (salesRep) params.set("salesRep", salesRep);
    if (checkDate) params.set("checkDate", checkDate);
    if (periodId) params.set("periodId", periodId);

    const res = await fetch(
      `/api/sales-commission/closed?${params.toString()}`,
    );
    const data = await res.json();
    if (res.ok) {
      setRows(data.rows || []);
    } else {
      setMessage(data.error || "Failed to load closed invoices.");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadPeriods();
    loadRows();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadRows();
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [client, invoice, salesRep, checkDate, periodId]);

  async function reopenInvoice(invoiceId: string) {
    if (appRole !== "admin") return;
    if (!confirm("Reopen this closed invoice?")) return;

    const res = await fetch("/api/sales-commission/closed", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage("Invoice reopened.");
      await loadRows();
    } else {
      setMessage(data.error || "Failed to reopen invoice.");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Closed Invoices
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Invoices where both first and second commission payments are
          completed.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-2">
        <input
          value={client}
          onChange={(e) => setClient(e.target.value)}
          placeholder="Client"
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
        />
        <input
          value={invoice}
          onChange={(e) => setInvoice(e.target.value)}
          placeholder="Invoice #"
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
        />
        <input
          value={salesRep}
          onChange={(e) => setSalesRep(e.target.value)}
          placeholder="Sales person"
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
        />
        <input
          type="date"
          value={checkDate}
          onChange={(e) => setCheckDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
        />
        <select
          value={periodId}
          onChange={(e) => setPeriodId(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
        >
          <option value="">All periods</option>
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {displayDateOnly(period.startDate)} -{" "}
              {displayDateOnly(period.endDate)}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-700 dark:text-gray-300">
          {message}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-auto">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              {[
                "Sales Rep",
                "Invoice Date",
                "Invoice #",
                "Customer",
                "% Cms",
                "Period Added",
                "1st Payment / Date",
                "2nd Payment / Date",
                "Status",
                "Actions",
              ].map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase"
                >
                  {header}
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
                  {row.salesRepDisplay || row.salesRepInitialsRaw || "-"}
                </td>
                <td className="px-4 py-3">
                  {displayDateOnly(row.invoiceDate)}
                </td>
                <td className="px-4 py-3 font-mono">
                  {qbUrl(row.quickbooksTxnId) ? (
                    <a
                      href={qbUrl(row.quickbooksTxnId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                      title="Open invoice in QuickBooks"
                    >
                      <span>{row.invoiceNumber || "-"}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    row.invoiceNumber || "-"
                  )}
                </td>
                <td className="px-4 py-3">{row.customerName}</td>
                <td className="px-4 py-3">
                  {row.commissionRate !== null &&
                  row.commissionRate !== undefined
                    ? `${Number(row.commissionRate).toFixed(2)}%`
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  {row.period
                    ? `${displayDateOnly(row.period.startDate)} - ${displayDateOnly(row.period.endDate)}`
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  <div>
                    $
                    {Number(
                      row.firstPaymentNowOverride ||
                        row.firstPaymentNowCalculated ||
                        0,
                    ).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {displayDateOnly(row.depositPaidDate)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>
                    $
                    {Number(
                      row.secondPaymentNowOverride ||
                        row.secondPaymentNowCalculated ||
                        0,
                    ).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {displayDateOnly(row.fullyPaidDate || row.closedAt)}
                  </div>
                </td>
                <td className="px-4 py-3">{row.status}</td>
                <td className="px-4 py-3">
                  {appRole === "admin" ? (
                    <button
                      type="button"
                      onClick={() => reopenInvoice(row.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-gray-300 text-gray-700 text-xs hover:bg-gray-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reopen
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">Admin only</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-10 text-center text-gray-500 text-sm"
                >
                  No closed invoices found.
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

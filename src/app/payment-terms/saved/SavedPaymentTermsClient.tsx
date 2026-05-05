"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Printer, Search } from "lucide-react";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";

type SavedPaymentTermRow = {
  id: string;
  paymentTermNumber: string;
  revNum: string;
  title: string;
  customerName: string;
  dealName: string;
  address: string | null;
  salesRep: string | null;
  showInCustomerFiles: boolean;
  createdAt: string;
};

interface Props {
  rows: SavedPaymentTermRow[];
  currentUserName: string;
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SavedPaymentTermsClient({
  rows,
  currentUserName,
}: Props) {
  const [search, setSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedSalesReps, setSelectedSalesReps] = useState<string[]>(() => {
    const me = currentUserName.trim();
    if (!me) return [];
    const hasMine = rows.some(
      (r) => (r.salesRep ?? "").trim().toLowerCase() === me.toLowerCase(),
    );
    return hasMine ? [me] : [];
  });

  const salesRepOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row) => {
      const rep = row.salesRep?.trim();
      if (rep) set.add(rep);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cq = clientSearch.trim().toLowerCase();

    return rows.filter((row) => {
      const rep = (row.salesRep ?? "").trim().toLowerCase();
      if (selectedSalesReps.length > 0) {
        const allowed = selectedSalesReps.map((v) => v.trim().toLowerCase());
        if (!allowed.includes(rep)) return false;
      }

      if (cq && !row.customerName.toLowerCase().includes(cq)) {
        return false;
      }

      if (!q) return true;

      return (
        row.paymentTermNumber.toLowerCase().includes(q) ||
        row.customerName.toLowerCase().includes(q) ||
        row.dealName.toLowerCase().includes(q) ||
        (row.salesRep ?? "").toLowerCase().includes(q) ||
        (row.address ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, clientSearch, selectedSalesReps]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Saved Payment Terms
        </h1>
        <Link
          href="/payment-terms"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
        >
          <FileText className="w-4 h-4" />
          New Payment Term
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-4xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payment terms..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="Filter by client name"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <div>
          <FilterMultiSelect
            label="Sales Rep"
            options={salesRepOptions}
            selected={selectedSalesReps}
            onChange={setSelectedSalesReps}
            fullWidth
            matchInputStyle
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-10 text-center text-gray-400 text-sm">
          {rows.length === 0
            ? "No saved payment terms yet."
            : "No payment terms match your search."}
        </div>
      ) : (
        <>
          {/* ── Mobile cards (< md) ── */}
          <div className="md:hidden space-y-3">
            {filtered.map((row) => (
              <div
                key={row.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/payment-terms?artifactId=${encodeURIComponent(row.id)}&mode=view`}
                    className="font-mono font-bold text-teal-700 dark:text-teal-400 hover:underline text-base"
                  >
                    {row.paymentTermNumber}
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {row.showInCustomerFiles ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium dark:bg-green-900/30 dark:text-green-300">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs font-medium dark:bg-gray-700 dark:text-gray-300">
                        Hidden
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                  {row.customerName}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {row.dealName}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    Rev {row.revNum} · {row.salesRep || "-"}
                  </span>
                  <span>{fmtDate(row.createdAt)}</span>
                </div>
                <div className="pt-1">
                  <a
                    href={`/payment-term-print/${encodeURIComponent(row.id)}?autoprint=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Pmt. Term
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop table (≥ md) ── */}
          <div className="hidden md:block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Term #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Rev
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Deal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Sales Rep
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Show in Customers
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/40"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-teal-700 dark:text-teal-400">
                      <Link
                        href={`/payment-terms?artifactId=${encodeURIComponent(row.id)}&mode=view`}
                        className="hover:underline"
                      >
                        {row.paymentTermNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{row.revNum}</td>
                    <td className="px-4 py-3">{row.customerName}</td>
                    <td className="px-4 py-3">{row.dealName}</td>
                    <td className="px-4 py-3">{row.salesRep || "-"}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {fmtDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {row.showInCustomerFiles ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium dark:bg-green-900/30 dark:text-green-300">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs font-medium dark:bg-gray-700 dark:text-gray-300">
                          Hidden
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/payment-term-print/${encodeURIComponent(row.id)}?autoprint=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Pmt. Term
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

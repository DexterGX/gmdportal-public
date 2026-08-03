"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { ArrowLeft, Clock, Download, Printer, X } from "lucide-react";
import FilterMultiSelect from "@/components/filters/FilterMultiSelect";
import type { StoreTransaction } from "../types";
import { TRANSACTION_TYPE_LABELS } from "../types";

export default function MovementsClient() {
  const [transactions, setTransactions] = useState<StoreTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch("/api/store-inventory/transactions");
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const typeOptions = useMemo(
    () => Array.from(new Set(Object.values(TRANSACTION_TYPE_LABELS))),
    [],
  );
  const itemOptions = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.item?.name).filter(Boolean))) as string[],
    [transactions],
  );
  const userOptions = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.user?.name).filter(Boolean))) as string[],
    [transactions],
  );
  const departmentOptions = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.item?.department?.label).filter(Boolean))) as string[],
    [transactions],
  );
  const groupOptions = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.item?.group?.label).filter(Boolean))) as string[],
    [transactions],
  );

  const visibleTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (selectedTypes.length > 0 && !selectedTypes.includes(TRANSACTION_TYPE_LABELS[t.type])) return false;
      if (selectedItems.length > 0 && !selectedItems.includes(t.item?.name ?? "")) return false;
      if (selectedUsers.length > 0 && !selectedUsers.includes(t.user?.name ?? "")) return false;
      if (selectedDepartments.length > 0 && !selectedDepartments.includes(t.item?.department?.label ?? "")) {
        return false;
      }
      if (selectedGroups.length > 0 && !selectedGroups.includes(t.item?.group?.label ?? "")) return false;
      return true;
    });
  }, [transactions, selectedTypes, selectedItems, selectedUsers, selectedDepartments, selectedGroups]);

  const hasActiveFilters =
    selectedTypes.length > 0 ||
    selectedItems.length > 0 ||
    selectedUsers.length > 0 ||
    selectedDepartments.length > 0 ||
    selectedGroups.length > 0;

  function clearFilters() {
    setSelectedTypes([]);
    setSelectedItems([]);
    setSelectedUsers([]);
    setSelectedDepartments([]);
    setSelectedGroups([]);
  }

  function exportCsv() {
    const csv = Papa.unparse(
      visibleTransactions.map((t) => ({
        Date: new Date(t.createdAt).toLocaleString(),
        Item: t.item?.name ?? "",
        Department: t.item?.department?.label ?? "",
        Group: t.item?.group?.label ?? "",
        Type: TRANSACTION_TYPE_LABELS[t.type],
        Change: t.change,
        "Old Qty": t.oldQuantity,
        "New Qty": t.newQuantity,
        User: t.user?.name ?? "",
        Reason: t.reason ?? "",
      })),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `store-inventory-movements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Link
        href="/store-inventory"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Store Inventory
      </Link>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Clock className="w-7 h-7" />
            Movements Log
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Every check-out, restock, and adjustment.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <FilterMultiSelect label="Type" options={typeOptions} selected={selectedTypes} onChange={setSelectedTypes} matchInputStyle />
          <FilterMultiSelect label="Item" options={itemOptions} selected={selectedItems} onChange={setSelectedItems} matchInputStyle />
          <FilterMultiSelect label="User" options={userOptions} selected={selectedUsers} onChange={setSelectedUsers} matchInputStyle />
          <FilterMultiSelect
            label="Department"
            options={departmentOptions}
            selected={selectedDepartments}
            onChange={setSelectedDepartments}
            matchInputStyle
          />
          <FilterMultiSelect label="Group" options={groupOptions} selected={selectedGroups} onChange={setSelectedGroups} matchInputStyle />
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <X className="w-3.5 h-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {visibleTransactions.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <p className="text-gray-500 dark:text-gray-400">
            {hasActiveFilters ? "No movements match your filters" : "No movements recorded yet"}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Department / Group
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Change
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {visibleTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-6 py-4 text-left">
                      <Link
                        href={`/store-inventory/${t.itemId}`}
                        className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {t.item?.name ?? "—"}
                      </Link>
                      {t.reason && <div className="text-xs text-gray-500 dark:text-gray-500">{t.reason}</div>}
                    </td>
                    <td className="px-6 py-4 text-center text-xs text-gray-600 dark:text-gray-400">
                      {t.item?.department?.label ?? "—"}
                      {t.item?.group ? ` · ${t.item.group.label}` : ""}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-gray-300">
                      {TRANSACTION_TYPE_LABELS[t.type]}
                    </td>
                    <td className="px-6 py-4 text-center text-sm">
                      <span className={t.change >= 0 ? "text-green-600" : "text-red-600"}>
                        {t.change >= 0 ? "+" : ""}
                        {t.change}
                      </span>
                      <span className="text-gray-400 ml-1">
                        ({t.oldQuantity} → {t.newQuantity})
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-gray-300">
                      {t.user?.name ?? "System"}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {visibleTransactions.map((t) => (
              <div key={t.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Link
                    href={`/store-inventory/${t.itemId}`}
                    className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {t.item?.name ?? "—"}
                  </Link>
                  <span className="text-xs text-gray-500 dark:text-gray-400 text-right shrink-0">
                    {TRANSACTION_TYPE_LABELS[t.type]}
                  </span>
                </div>
                {(t.item?.department || t.item?.group) && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {t.item?.department?.label ?? "—"}
                    {t.item?.group ? ` · ${t.item.group.label}` : ""}
                  </div>
                )}
                <div className="text-sm mb-2">
                  <span className={t.change >= 0 ? "text-green-600" : "text-red-600"}>
                    {t.change >= 0 ? "+" : ""}
                    {t.change}
                  </span>
                  <span className="text-gray-400 ml-1">
                    ({t.oldQuantity} → {t.newQuantity})
                  </span>
                </div>
                {t.reason && (
                  <div className="text-xs text-gray-500 dark:text-gray-500 mb-2">{t.reason}</div>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span>{t.user?.name ?? "System"}</span>
                  <span>{new Date(t.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

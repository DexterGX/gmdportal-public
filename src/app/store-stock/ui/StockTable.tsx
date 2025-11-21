"use client";
import React from "react";
import { Edit, PlusCircle, MinusCircle, FileText } from "lucide-react";

import type { StockItem } from "./StockManager";

export default function StockTable({
  items,
  loading,
  onEdit,
  onTransaction,
  onRefresh,
}: {
  items: StockItem[];
  loading: boolean;
  onEdit: (i: StockItem) => void;
  onTransaction: (i: StockItem) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Item Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Unit
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Provider
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Min Qty
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Updated At
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                >
                  Loading...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                >
                  No items found
                </td>
              </tr>
            )}

            {items.map((item) => {
              const low = item.quantity < item.minQuantity;
              return (
                <tr
                  key={item.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors ${
                    low ? "bg-red-50 dark:bg-red-900/20" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {item.category}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`font-semibold ${
                        low
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {item.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {item.unit}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {item.providor ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {item.minQuantity}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        title="Edit"
                        onClick={() => onEdit(item)}
                        className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        title="Add/Remove stock"
                        onClick={() => onTransaction(item)}
                        className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                      >
                        <PlusCircle className="w-4 h-4" />
                      </button>
                      <button
                        title="View log"
                        className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

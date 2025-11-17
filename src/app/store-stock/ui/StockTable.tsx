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
    <div className="overflow-x-auto bg-white rounded shadow">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 text-left">Item Name</th>
            <th className="p-3 text-left">Category</th>
            <th className="p-3 text-left">Quantity</th>
            <th className="p-3 text-left">Unit</th>
            <th className="p-3 text-left">Providor</th>
            <th className="p-3 text-left">Min Qty</th>
            <th className="p-3 text-left">Updated At</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={8} className="p-4 text-center">
                Loading...
              </td>
            </tr>
          )}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={8} className="p-4 text-center">
                No items
              </td>
            </tr>
          )}

          {items.map((item) => {
            const low = item.quantity < item.minQuantity;
            return (
              <tr key={item.id} className={low ? "bg-red-50" : ""}>
                <td className="p-3">{item.name}</td>
                <td className="p-3">{item.category}</td>
                <td className={`p-3 font-medium ${low ? "text-red-700" : ""}`}>
                  {item.quantity}
                </td>
                <td className="p-3">{item.unit}</td>
                <td className="p-3">{item.providor ?? "-"}</td>
                <td className="p-3">{item.minQuantity}</td>
                <td className="p-3">
                  {new Date(item.updatedAt).toLocaleString()}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button
                      title="Edit"
                      onClick={() => onEdit(item)}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      title="Add stock"
                      onClick={() => onTransaction(item)}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <PlusCircle size={16} />
                    </button>
                    <button
                      title="Remove stock"
                      onClick={() => onTransaction(item)}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <MinusCircle size={16} />
                    </button>
                    <button
                      title="View log"
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <FileText size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

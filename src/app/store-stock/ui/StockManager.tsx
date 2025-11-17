"use client";

import React, { useEffect, useMemo, useState } from "react";
import StockFilters from "./StockFilters";
import StockTable from "./StockTable";
import ItemModal from "./ItemModal";
import TransactionModal from "./TransactionModal";

export type StockItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  providor?: string | null;
  notes?: string | null;
  updatedAt: string;
};

export default function StockManager() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  const [txModal, setTxModal] = useState(false);
  const [txTarget, setTxTarget] = useState<StockItem | null>(null);

  async function fetchItems() {
    setLoading(true);
    try {
      const url = new URL(`/api/stock`, window.location.origin);
      if (query) url.searchParams.set("q", query);
      if (category) url.searchParams.set("category", category);
      const res = await fetch(url.toString());
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return Array.from(set).filter(Boolean);
  }, [items]);

  function openNew() {
    setEditingItem(null);
    setShowItemModal(true);
  }

  function openEdit(item: StockItem) {
    setEditingItem(item);
    setShowItemModal(true);
  }

  function openTransaction(item: StockItem) {
    setTxTarget(item);
    setTxModal(true);
  }

  async function handleSaveItem(payload: any) {
    // If editing -> PUT else POST
    try {
      const method = payload.id ? "PUT" : "POST";
      const url = payload.id ? `/api/stock/${payload.id}` : `/api/stock`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");
      setShowItemModal(false);
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleTransaction(data: {
    itemId: string;
    change: number;
    reason?: string;
  }) {
    try {
      const res = await fetch(`/api/stock/transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Transaction failed");
      setTxModal(false);
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Store Stock</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={openNew}
            className="px-3 py-1 rounded bg-sky-600 text-white hover:bg-sky-700"
          >
            Add New Item
          </button>
        </div>
      </div>

      <StockFilters
        query={query}
        setQuery={setQuery}
        category={category}
        setCategory={setCategory}
        categories={categories}
      />

      <StockTable
        items={items}
        loading={loading}
        onEdit={openEdit}
        onTransaction={openTransaction}
        onRefresh={fetchItems}
      />

      {showItemModal && (
        <ItemModal
          onClose={() => setShowItemModal(false)}
          onSave={handleSaveItem}
          item={editingItem}
        />
      )}

      {txModal && txTarget && (
        <TransactionModal
          onClose={() => setTxModal(false)}
          onSubmit={handleTransaction}
          item={txTarget}
        />
      )}
    </div>
  );
}

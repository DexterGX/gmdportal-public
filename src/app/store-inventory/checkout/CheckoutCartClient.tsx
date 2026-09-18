"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, ShoppingCart, Package } from "lucide-react";
import { useCart } from "../CartContext";

export default function CheckoutCartClient() {
  const { lines: cart, updateLine, removeFromCart, clearCart } = useCart();

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  // Raw text of each line's Qty input while the user is actively editing it,
  // so the field can go empty instead of snapping back to "0" mid-edit.
  // Cleared on blur so the field re-syncs with the committed cart quantity.
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});

  function handleQtyChange(itemId: string, raw: string) {
    setQtyDrafts((prev) => ({ ...prev, [itemId]: raw }));
    updateLine(itemId, { quantity: raw === "" ? 0 : Number(raw) });
  }

  function handleQtyBlur(itemId: string) {
    setQtyDrafts((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

  const hasInvalidLine = cart.some((line) => line.quantity <= 0 || line.quantity > line.item.quantity);

  async function handleSubmit() {
    if (cart.length === 0 || hasInvalidLine) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/store-inventory/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: cart.map((line) => ({ itemId: line.item.id, quantity: line.quantity, reason: line.reason })),
        }),
      });
      const body = await res.json();
      const failed = (body.results ?? []).filter((r: { ok: boolean }) => !r.ok);
      if (failed.length > 0) {
        showToast("error", `${failed.length} item(s) failed to check out`);
      } else {
        showToast("success", `Checked out ${cart.length} item(s)`);
        clearCart();
      }
    } catch (error) {
      showToast("error", "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}

      <Link
        href="/store-inventory"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Store Inventory
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <ShoppingCart className="w-7 h-7" />
          Check Out Items
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Use the cart icon on Overview or an item page to add things here, then check everything out at once.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Cart ({cart.length})</h2>
        {cart.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Your cart is empty.</p>
            <Link href="/store-inventory" className="text-blue-600 hover:underline text-sm">
              Browse Store Inventory
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((line) => {
              const invalid = line.quantity <= 0 || line.quantity > line.item.quantity;
              return (
                <div key={line.item.id} className="p-3 rounded-md border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <Link
                        href={`/store-inventory/${line.item.id}`}
                        className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {line.item.name}
                      </Link>
                      {line.item.location && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Location: {line.item.location}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeFromCart(line.item.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-gray-500 dark:text-gray-400">
                        Qty (max {line.item.quantity})
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={line.item.quantity}
                        value={qtyDrafts[line.item.id] ?? line.quantity}
                        onChange={(e) => handleQtyChange(line.item.id, e.target.value)}
                        onBlur={() => handleQtyBlur(line.item.id)}
                        className="w-full mt-0.5 p-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500 dark:text-gray-400">Reason / Job</label>
                      <input
                        value={line.reason}
                        onChange={(e) => updateLine(line.item.id, { reason: e.target.value })}
                        className="w-full mt-0.5 p-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>
                  {invalid && (
                    <p className="text-[11px] text-red-600 mt-1">
                      Quantity must be between 1 and {line.item.quantity}.
                    </p>
                  )}
                </div>
              );
            })}

            <button
              onClick={handleSubmit}
              disabled={submitting || hasInvalidLine}
              className="w-full mt-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {submitting ? "Checking out..." : `Check Out ${cart.length} Item(s)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

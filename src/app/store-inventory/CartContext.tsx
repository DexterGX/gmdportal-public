"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { StoreItem } from "./types";

export type CartLine = { item: StoreItem; quantity: number; reason: string };

type CartContextValue = {
  lines: CartLine[];
  totalItems: number;
  addToCart: (item: StoreItem, quantity: number, reason: string) => void;
  updateLine: (itemId: string, patch: Partial<Pick<CartLine, "quantity" | "reason">>) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

// Lives at the store-inventory layout level so the cart persists as the user
// browses Overview / item detail pages and adds things, then finalizes
// everything at once from the Check Out Items page.
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const addToCart = useCallback((item: StoreItem, quantity: number, reason: string) => {
    setLines((prev) => {
      const existing = prev.find((line) => line.item.id === item.id);
      if (existing) {
        return prev.map((line) => (line.item.id === item.id ? { ...line, quantity, reason } : line));
      }
      return [...prev, { item, quantity, reason }];
    });
  }, []);

  const updateLine = useCallback(
    (itemId: string, patch: Partial<Pick<CartLine, "quantity" | "reason">>) => {
      setLines((prev) => prev.map((line) => (line.item.id === itemId ? { ...line, ...patch } : line)));
    },
    [],
  );

  const removeFromCart = useCallback((itemId: string) => {
    setLines((prev) => prev.filter((line) => line.item.id !== itemId));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const totalItems = lines.length;

  const value = useMemo(
    () => ({ lines, totalItems, addToCart, updateLine, removeFromCart, clearCart }),
    [lines, totalItems, addToCart, updateLine, removeFromCart, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

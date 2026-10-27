"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface CartLine {
  product_id: string;
  quantity: number;
}

interface CartApi {
  lines: CartLine[];
  count: number;
  ready: boolean;
  add: (productId: string, qty?: number, max?: number) => void;
  setQty: (productId: string, qty: number, max?: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const KEY = "adzkia-cart-v1";
const Ctx = createContext<CartApi | null>(null);

export function useCart(): CartApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart di luar CartProvider");
  return c;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw) as CartLine[]);
    } catch {
      /* keranjang kosong */
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: CartLine[]) => {
    setLines(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* abaikan */
    }
  }, []);

  const clamp = (q: number, max?: number) => Math.max(1, Math.min(q, max ?? 1000));

  const api = useMemo<CartApi>(
    () => ({
      lines,
      count: lines.reduce((a, l) => a + l.quantity, 0),
      ready,
      add: (id, qty = 1, max) => {
        const found = lines.find((l) => l.product_id === id);
        persist(
          found
            ? lines.map((l) => (l.product_id === id ? { ...l, quantity: clamp(l.quantity + qty, max) } : l))
            : [...lines, { product_id: id, quantity: clamp(qty, max) }],
        );
      },
      setQty: (id, qty, max) => persist(lines.map((l) => (l.product_id === id ? { ...l, quantity: clamp(qty, max) } : l))),
      remove: (id) => persist(lines.filter((l) => l.product_id !== id)),
      clear: () => persist([]),
    }),
    [lines, ready, persist],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

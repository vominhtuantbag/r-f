import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface CartLine {
  id: string;
  restaurantId: string;
  restaurantName: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  addonNames: string[];
  notes?: string | null;
}

interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  subtotalMinor: number;
  addLine: (line: Omit<CartLine, 'id'> & { id?: string }) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const addLine = useCallback((line: Omit<CartLine, 'id'> & { id?: string }) => {
    setLines((prev) => {
      const existing = prev.find(
        (l) =>
          l.menuItemId === line.menuItemId &&
          l.restaurantId === line.restaurantId &&
          (l.notes ?? '') === (line.notes ?? ''),
      );
      if (existing) {
        return prev.map((l) =>
          l.id === existing.id
            ? { ...l, quantity: l.quantity + line.quantity }
            : l,
        );
      }
      return [
        ...prev,
        {
          ...line,
          id: line.id ?? `cart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((id: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0 ? prev.filter((l) => l.id !== id) : prev.map((l) => (l.id === id ? { ...l, quantity } : l)),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const subtotalMinor = lines.reduce((s, l) => s + l.unitPriceMinor * l.quantity, 0);
    const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
    return { lines, itemCount, subtotalMinor, addLine, setQuantity, clear };
  }, [addLine, clear, lines, setQuantity]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart requires CartProvider');
  return ctx;
}

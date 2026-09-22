import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductDto } from "../stores/types";

export interface CartLine {
  product: ProductDto;
  quantity: number;
}

export interface CartStoreGroup {
  storeId: string;
  storeName: string;
  lines: CartLine[];
}

interface CartState {
  /** `storeId -> productId -> línea`. Un pedido puede mezclar varias tiendas a la vez. */
  groups: Record<string, { storeName: string; lines: Record<string, CartLine> }>;
  add: (storeId: string, storeName: string, product: ProductDto, quantity?: number) => void;
  setQuantity: (storeId: string, productId: string, quantity: number) => void;
  removeLine: (storeId: string, productId: string) => void;
  clearStore: (storeId: string) => void;
  clear: () => void;
}

const MAX_QUANTITY = 20;

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      groups: {},
      add: (storeId, storeName, product, quantity = 1) =>
        set((state) => {
          const group = state.groups[storeId] ?? { storeName, lines: {} };
          const existing = group.lines[product.id];
          const nextQuantity = Math.min(MAX_QUANTITY, (existing?.quantity ?? 0) + quantity);
          return {
            groups: {
              ...state.groups,
              [storeId]: {
                storeName,
                lines: { ...group.lines, [product.id]: { product, quantity: nextQuantity } },
              },
            },
          };
        }),
      setQuantity: (storeId, productId, quantity) =>
        set((state) => {
          const group = state.groups[storeId];
          if (!group?.lines[productId]) return state;
          if (quantity <= 0) {
            const { [productId]: _removed, ...rest } = group.lines;
            const lineCount = Object.keys(rest).length;
            const { [storeId]: _group, ...otherGroups } = state.groups;
            return lineCount === 0
              ? { groups: otherGroups }
              : { groups: { ...state.groups, [storeId]: { ...group, lines: rest } } };
          }
          const clamped = Math.min(MAX_QUANTITY, quantity);
          return {
            groups: {
              ...state.groups,
              [storeId]: {
                ...group,
                lines: {
                  ...group.lines,
                  [productId]: { ...group.lines[productId], quantity: clamped },
                },
              },
            },
          };
        }),
      removeLine: (storeId, productId) =>
        set((state) => {
          const group = state.groups[storeId];
          if (!group) return state;
          const { [productId]: _removed, ...rest } = group.lines;
          if (Object.keys(rest).length === 0) {
            const { [storeId]: _group, ...otherGroups } = state.groups;
            return { groups: otherGroups };
          }
          return { groups: { ...state.groups, [storeId]: { ...group, lines: rest } } };
        }),
      clearStore: (storeId) =>
        set((state) => {
          const { [storeId]: _removed, ...rest } = state.groups;
          return { groups: rest };
        }),
      clear: () => set({ groups: {} }),
    }),
    { name: "neirapp.cart" },
  ),
);

type CartGroups = CartState["groups"];

// Estas tres funciones reciben el `groups` crudo (no el store completo) a propósito: son
// derivaciones puras para usar con `useMemo` en el componente, nunca como selector directo de
// `useCartStore`. Un selector de Zustand debe devolver una referencia estable; `cartGroups`
// construye un array nuevo en cada llamada, y pasarlo tal cual a `useCartStore` produce un bucle
// infinito de renders (useSyncExternalStore ve una "snapshot" distinta en cada lectura).
export function cartGroups(groups: CartGroups): CartStoreGroup[] {
  return Object.entries(groups).map(([storeId, group]) => ({
    storeId,
    storeName: group.storeName,
    lines: Object.values(group.lines),
  }));
}

export function cartTotalItems(groups: CartGroups): number {
  return Object.values(groups).reduce(
    (sum, group) => sum + Object.values(group.lines).reduce((s, l) => s + l.quantity, 0),
    0,
  );
}

export function cartTotalCop(groups: CartGroups): number {
  return Object.values(groups).reduce(
    (sum, group) =>
      sum + Object.values(group.lines).reduce((s, l) => s + l.product.price_cop * l.quantity, 0),
    0,
  );
}

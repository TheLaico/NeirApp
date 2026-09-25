import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

// Carrito con la misma forma que el de la rama neirapp-architecture-plan:
// groups = { [storeId]: { storeName, lines: { [productId]: { product, quantity } } } }
// Un pedido puede mezclar varias tiendas a la vez.
const STORAGE_KEY = 'neirapp.frontend.cart';
const MAX_QUANTITY = 20;

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
};

function withoutKey(obj, key) {
  const { [key]: _removed, ...rest } = obj;
  return rest;
}

function reducer(groups, action) {
  switch (action.type) {
    case 'add': {
      const { storeId, storeName, product } = action;
      const group = groups[storeId] ?? { storeName, lines: {} };
      const current = group.lines[product.id]?.quantity ?? 0;
      const quantity = Math.min(MAX_QUANTITY, current + 1);
      return {
        ...groups,
        [storeId]: { storeName, lines: { ...group.lines, [product.id]: { product, quantity } } },
      };
    }
    case 'set': {
      const { storeId, productId, quantity } = action;
      const group = groups[storeId];
      if (!group?.lines[productId]) return groups;
      if (quantity <= 0) return reducer(groups, { type: 'remove', storeId, productId });
      const clamped = Math.min(MAX_QUANTITY, quantity);
      return {
        ...groups,
        [storeId]: {
          ...group,
          lines: { ...group.lines, [productId]: { ...group.lines[productId], quantity: clamped } },
        },
      };
    }
    case 'remove': {
      const group = groups[action.storeId];
      if (!group) return groups;
      const lines = withoutKey(group.lines, action.productId);
      return Object.keys(lines).length === 0
        ? withoutKey(groups, action.storeId)
        : { ...groups, [action.storeId]: { ...group, lines } };
    }
    case 'clear':
      return {};
    default:
      return groups;
  }
}

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [groups, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    } catch {
      /* sin almacenamiento disponible: el carrito vive solo en memoria */
    }
  }, [groups]);

  const value = useMemo(() => {
    const list = Object.entries(groups).map(([storeId, group]) => ({
      storeId,
      storeName: group.storeName,
      lines: Object.values(group.lines),
    }));
    const lines = list.flatMap((g) => g.lines);
    return {
      groups: list,
      totalItems: lines.reduce((sum, l) => sum + l.quantity, 0),
      totalCop: lines.reduce((sum, l) => sum + l.product.price_cop * l.quantity, 0),
      quantityOf: (storeId, productId) => groups[storeId]?.lines[productId]?.quantity ?? 0,
      add: (store, product) =>
        dispatch({ type: 'add', storeId: store.id, storeName: store.name, product }),
      setQuantity: (storeId, productId, quantity) =>
        dispatch({ type: 'set', storeId, productId, quantity }),
      remove: (storeId, productId) => dispatch({ type: 'remove', storeId, productId }),
      clear: () => dispatch({ type: 'clear' }),
    };
  }, [groups]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}

export { MAX_QUANTITY };

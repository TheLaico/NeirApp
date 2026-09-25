import { useSyncExternalStore } from 'react';

/**
 * Catálogo local: tiendas y productos creados desde el panel de administrador, guardados en este navegador.
 *
 * Existe porque crear tiendas en el backend exige una sesión real (JWT) y la aprobación de un administrador,
 * y el login de la app todavía es simulado. Cuando eso exista, `createStore` / `addProduct` se reemplazan por
 * llamadas a `POST /api/v1/stores` y `POST /api/v1/stores/{id}/products`; el resto de la app no cambia.
 *
 * Las tiendas tienen la misma forma que `StoreResponse` del backend y ids con el prefijo `local-`.
 */
const KEY = 'neirapp.frontend.local-catalog';
const EMPTY = { stores: [], products: {} }; // products: { [storeId]: Product[] }

const load = () => {
  try {
    return { ...EMPTY, ...(JSON.parse(localStorage.getItem(KEY)) ?? {}) };
  } catch {
    return EMPTY;
  }
};

let state = load();
const listeners = new Set();

const commit = (next) => {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* sin almacenamiento: el catálogo vive solo en memoria */
  }
  listeners.forEach((l) => l());
};

const newId = (kind) => `local-${kind}-${crypto.randomUUID().slice(0, 8)}`;

export const isLocalId = (id) => typeof id === 'string' && id.startsWith('local-');

export const localCatalog = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,

  createStore({ name, category, description, lat, lng }, ownerId) {
    const store = {
      id: newId('store'),
      owner_user_id: ownerId,
      name: name.trim(),
      category,
      description: description.trim(),
      lat,
      lng,
      is_open: true,
      is_approved: true,
      is_rejected: false,
      created_at: new Date().toISOString(),
    };
    commit({ ...state, stores: [store, ...state.stores], products: { ...state.products, [store.id]: [] } });
    return store;
  },

  updateStore(id, patch) {
    commit({ ...state, stores: state.stores.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  },

  removeStore(id) {
    const { [id]: _removed, ...products } = state.products;
    commit({ stores: state.stores.filter((s) => s.id !== id), products });
  },

  addProduct(storeId, { name, description, price_cop }) {
    const product = {
      id: newId('product'),
      store_id: storeId,
      name: name.trim(),
      description: description.trim(),
      price_cop,
      image_url: null,
      is_available: true,
    };
    commit({ ...state, products: { ...state.products, [storeId]: [...(state.products[storeId] ?? []), product] } });
    return product;
  },

  updateProduct(storeId, productId, patch) {
    commit({
      ...state,
      products: {
        ...state.products,
        [storeId]: (state.products[storeId] ?? []).map((p) => (p.id === productId ? { ...p, ...patch } : p)),
      },
    });
  },

  removeProduct(storeId, productId) {
    commit({
      ...state,
      products: { ...state.products, [storeId]: (state.products[storeId] ?? []).filter((p) => p.id !== productId) },
    });
  },
};

/** Catálogo local reactivo: se actualiza solo cuando cambia. */
export const useLocalCatalog = () => useSyncExternalStore(localCatalog.subscribe, localCatalog.getSnapshot);

import { useCallback, useEffect, useState } from 'react';
import { authRequest } from '../../services/auth.js';
import { normalizeStore } from './categories.jsx';

const API = '/api/v1';

// Tiendas reales desde la API (/api/v1/stores, con proxy a localhost:8000 en desarrollo).
// status: 'loading' | 'ok' | 'error'. `refresh()` vuelve a pedirlas (por ejemplo tras crear una).
export function useStores() {
  const [state, setState] = useState({ stores: [], status: 'loading' });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const json = (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };
    // La calificación de cada tienda viene aparte (módulo de reseñas); si falla, la lista se muestra sin ella.
    const ratings = fetch(`${API}/reviews/summaries`, { signal: controller.signal }).then(json).catch(() => []);
    Promise.all([fetch(`${API}/stores`, { signal: controller.signal }).then(json), ratings])
      .then(([data, summaries]) => {
        const byStore = new Map(summaries.map((r) => [r.store_id, r]));
        const withRating = data.map((s) => ({ ...s, rating: byStore.get(s.id)?.average ?? null, reviews_count: byStore.get(s.id)?.count ?? 0 }));
        setState({ stores: withRating.map(normalizeStore), status: 'ok' });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setState((s) => ({ ...s, status: 'error' }));
      });
    return () => controller.abort();
  }, [version]);

  return { ...state, refresh };
}

/** Todas las tiendas para el administrador (también las ocultas), con el correo de su dueño. */
export function useAdminStores() {
  const [state, setState] = useState({ stores: [], status: 'loading' });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(async () => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    authRequest(`${API}/admin/stores`)
      .then((data) => !cancelled && setState({ stores: data.map(normalizeStore), status: 'ok' }))
      .catch(() => !cancelled && setState((s) => ({ ...s, status: 'error' })));
    return () => {
      cancelled = true;
    };
  }, [version]);

  return { ...state, refresh };
}

// Productos de una tienda: /api/v1/stores/{id}/products. status: 'loading' | 'ok' | 'error'
export function useStoreProducts(storeId) {
  const [state, setState] = useState({ products: [], status: 'loading' });

  useEffect(() => {
    if (!storeId) return undefined;
    const controller = new AbortController();
    setState({ products: [], status: 'loading' });
    fetch(`${API}/stores/${storeId}/products`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((products) => setState({ products, status: 'ok' }))
      .catch((err) => {
        if (err.name !== 'AbortError') setState({ products: [], status: 'error' });
      });
    return () => controller.abort();
  }, [storeId]);

  return state;
}

// Horario de una tienda (público): para mostrarle al cliente cuándo abre.
export function useStoreSchedule(storeId) {
  const [schedule, setSchedule] = useState(null);

  useEffect(() => {
    if (!storeId) return undefined;
    const controller = new AbortController();
    setSchedule(null);
    fetch(`${API}/stores/${storeId}/schedule`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then(setSchedule)
      .catch(() => {});
    return () => controller.abort();
  }, [storeId]);

  return schedule;
}

// Endpoints que exigen sesión: los usa el panel de administrador y el del comerciante.
export const storesApi = {
  // Solo administrador: cambia el dueño (owner_email), la posición (lat, lng) o si aparece en el mapa (is_listed).
  adminUpdate: (storeId, body) => authRequest(`${API}/admin/stores/${storeId}`, { method: 'PATCH', body }),
  // Solo administrador: las tiendas recomendadas, en orden (la primera del arreglo va primero).
  setRecommended: (storeIds) => authRequest(`${API}/stores/recommended`, { method: 'PUT', body: { store_ids: storeIds } }),
  // Solo administrador: crea la tienda de un comerciante (por su correo); nace aprobada.
  adminCreate: (body) => authRequest(`${API}/admin/stores`, { method: 'POST', body }),
  mine: () => authRequest(`${API}/stores/me`),
  // Perfil de la tienda: name, category, description, image_url ('' quita la foto).
  update: (storeId, body) => authRequest(`${API}/stores/${storeId}`, { method: 'PATCH', body }),
  setOpen: (storeId, isOpen) => authRequest(`${API}/stores/${storeId}/open`, { method: 'PATCH', body: { is_open: isOpen } }),
  // Horario semanal (los 7 días) y fechas en que no abre. `schedule` es público; lo demás, solo el dueño.
  schedule: (storeId) => authRequest(`${API}/stores/${storeId}/schedule`),
  setSchedule: (storeId, days) => authRequest(`${API}/stores/${storeId}/schedule`, { method: 'PUT', body: { days } }),
  clearSchedule: (storeId) => authRequest(`${API}/stores/${storeId}/schedule`, { method: 'DELETE' }),
  addClosedDate: (storeId, day, reason) => authRequest(`${API}/stores/${storeId}/closed-dates`, { method: 'POST', body: { day, reason } }),
  removeClosedDate: (storeId, day) => authRequest(`${API}/stores/${storeId}/closed-dates/${day}`, { method: 'DELETE' }),
  products: (storeId) => authRequest(`${API}/stores/${storeId}/products`),
  addProduct: (storeId, body) => authRequest(`${API}/stores/${storeId}/products`, { method: 'POST', body }),
  // Producto: name, description, price_cop, image_url ('' quita la foto).
  updateProduct: (storeId, productId, body) =>
    authRequest(`${API}/stores/${storeId}/products/${productId}`, { method: 'PATCH', body }),
  setProductAvailable: (storeId, productId, isAvailable) =>
    authRequest(`${API}/stores/${storeId}/products/${productId}/availability`, {
      method: 'PATCH',
      body: { is_available: isAvailable },
    }),
  removeProduct: (storeId, productId) => authRequest(`${API}/stores/${storeId}/products/${productId}`, { method: 'DELETE' }),
};

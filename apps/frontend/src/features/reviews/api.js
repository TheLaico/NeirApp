import { useEffect, useState } from 'react';
import { authRequest } from '../../services/auth.js';

// Reseñas para el comercio: la lista y el resumen son públicos; responder exige ser el dueño de la tienda.
export const reviewsApi = {
  summary: (storeId) => authRequest(`/api/v1/reviews/stores/${storeId}/summary`),
  list: (storeId) => authRequest(`/api/v1/reviews/stores/${storeId}`),
  reply: (reviewId, text) => authRequest(`/api/v1/reviews/${reviewId}/reply`, { method: 'POST', body: { text } }),
  // El cliente califica un pedido ya entregado por la tienda.
  create: (storeOrderId, rating, comment) =>
    authRequest('/api/v1/reviews', { method: 'POST', body: { store_order_id: storeOrderId, rating, comment: comment || null } }),
};

// Calificaciones de una tienda: /api/v1/reviews/stores/{id}/summary y /reviews/stores/{id}.
// El backend califica tiendas (pedidos), no productos sueltos.
export function useStoreReviews(storeId) {
  const [state, setState] = useState({ summary: null, reviews: [], status: 'loading' });

  useEffect(() => {
    if (!storeId) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    setState({ summary: null, reviews: [], status: 'loading' });

    const json = (url) =>
      fetch(url, { signal }).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });

    Promise.all([
      json(`/api/v1/reviews/stores/${storeId}/summary`),
      json(`/api/v1/reviews/stores/${storeId}`),
    ])
      .then(([summary, reviews]) => setState({ summary, reviews, status: 'ok' }))
      .catch((err) => {
        if (err.name !== 'AbortError') setState({ summary: null, reviews: [], status: 'error' });
      });
    return () => controller.abort();
  }, [storeId]);

  return state;
}

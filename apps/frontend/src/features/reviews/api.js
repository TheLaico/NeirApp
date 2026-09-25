import { useEffect, useState } from 'react';
import { isLocalId } from '../stores/localCatalog.js';

// Calificaciones de una tienda: /api/v1/reviews/stores/{id}/summary y /reviews/stores/{id}.
// El backend califica tiendas (pedidos), no productos sueltos.
export function useStoreReviews(storeId) {
  const [state, setState] = useState({ summary: null, reviews: [], status: 'loading' });

  useEffect(() => {
    if (!storeId || isLocalId(storeId)) return undefined;
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

  // Las tiendas locales todavía no tienen reseñas (se crean con pedidos en el servidor).
  if (isLocalId(storeId)) return { summary: { average: 0, count: 0 }, reviews: [], status: 'ok' };
  return state;
}

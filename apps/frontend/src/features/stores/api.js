import { useEffect, useState } from 'react';
import { normalizeStore } from './categories.jsx';
import { isLocalId, useLocalCatalog } from './localCatalog.js';

// Tiendas reales desde la API (/api/v1/stores, con proxy a localhost:8000 en desarrollo).
// status: 'loading' | 'ok' | 'error'
export function useStores() {
  const [remote, setRemote] = useState([]);
  const [remoteStatus, setStatus] = useState('loading');
  const local = useLocalCatalog();

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/stores', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setRemote(data.map(normalizeStore));
        setStatus('ok');
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setStatus('error');
      });
    return () => controller.abort();
  }, []);

  // Tiendas del servidor + tiendas creadas desde el panel de administrador (locales).
  const stores = [...remote, ...local.stores.filter((s) => s.is_approved).map((s) => ({ ...normalizeStore(s), isLocal: true }))];
  // Si el servidor falla pero hay tiendas locales, la lista igual se muestra.
  const status = remoteStatus === 'error' && stores.length > 0 ? 'ok' : remoteStatus;
  return { stores, status };
}

// Productos de una tienda: /api/v1/stores/{id}/products. status: 'loading' | 'ok' | 'error'
export function useStoreProducts(storeId) {
  const [state, setState] = useState({ products: [], status: 'loading' });
  const local = useLocalCatalog();

  useEffect(() => {
    if (!storeId || isLocalId(storeId)) return undefined;
    const controller = new AbortController();
    setState({ products: [], status: 'loading' });
    fetch(`/api/v1/stores/${storeId}/products`, { signal: controller.signal })
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

  if (isLocalId(storeId)) return { products: local.products[storeId] ?? [], status: 'ok' };
  return state;
}

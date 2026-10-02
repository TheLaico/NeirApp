import { ArrowLeft, MapPin, Search, Store } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useStoreProducts } from '../../features/stores/api.js';
import { formatDistance } from '../../features/stores/categories.jsx';
import ProductCard from '../../components/products/ProductCard.jsx';

const normalize = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function StoreDetail({ store, onBack, selectedProductId, onOpenProduct, overlayOpen, onOpenInfo, initialQuery = '' }) {
  const { products, status } = useStoreProducts(store.id);
  // Llega con lo que se buscó en el mapa (p. ej. "pizza"): se ve solo eso, y se puede borrar para ver todo.
  const [query, setQuery] = useState(initialQuery);

  // Escape vuelve a la lista de tiendas.
  useEffect(() => {
    // Con una pantalla abierta (producto o información de la tienda), Escape cierra esa primero.
    if (overlayOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && onBack();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onBack, overlayOpen]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return products;
    return products.filter((p) => normalize(`${p.name} ${p.description ?? ''}`).includes(q));
  }, [products, query]);

  return (
    <aside className="panel store-detail" aria-label={`Productos de ${store.name}`}>
      <div className="detail-head">
        <button type="button" className="back-btn" aria-label="Volver a las tiendas" onClick={onBack}>
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <div className="detail-title">
          <h2>{store.name}</h2>
          <p>
            <span>{store.label}</span>
            <span>
              <MapPin size={14} fill="currentColor" aria-hidden="true" />
              {formatDistance(store.distance)}
            </span>
            <span className={`open-tag${store.is_open === false ? ' closed' : ''}`}>
              {store.is_open === false ? 'Cerrado' : 'Abierto'}
            </span>
          </p>
        </div>
        <button type="button" className="view-store-btn" onClick={onOpenInfo}>
          <Store size={17} aria-hidden="true" />
          Ver tienda
        </button>
      </div>

      <label className="search detail-search">
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          placeholder={`Buscar en ${store.name}...`}
          aria-label="Buscar productos de la tienda"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {status === 'loading' && <p className="panel-empty">Cargando productos…</p>}
      {status === 'error' && (
        <p className="panel-empty" role="alert">
          No se pudieron cargar los productos. Intenta de nuevo más tarde.
        </p>
      )}
      {status === 'ok' && products.length === 0 && (
        <p className="panel-empty">Esta tienda todavía no tiene productos.</p>
      )}
      {status === 'ok' && products.length > 0 && visible.length === 0 && (
        <p className="panel-empty">No hay productos que coincidan con “{query}”.</p>
      )}

      <div className="product-grid">
        {visible.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            store={store}
            selected={p.id === selectedProductId}
            onOpen={onOpenProduct}
          />
        ))}
      </div>
    </aside>
  );
}

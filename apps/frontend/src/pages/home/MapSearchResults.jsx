import { ChevronRight, Loader2, SearchX } from 'lucide-react';
import './map-search.css';

/**
 * Accesos directos debajo del buscador del mapa: las tiendas cuyo nombre (o categoría) coincide y las tiendas que
 * venden lo buscado, con los productos que lo tienen. Tocar uno abre esa tienda; si vende lo buscado, su catálogo
 * llega filtrado (eso lo decide MapPage).
 */
export default function MapSearchResults({ query, byName, byProduct, loading, onOpen }) {
  const empty = !loading && byName.length === 0 && byProduct.length === 0;
  return (
    <div className="map-search-results" role="region" aria-label={`Resultados de “${query}”`}>
      {byName.length > 0 && (
        <>
          <p className="msr-title">Tiendas</p>
          <div className="msr-list">
            {byName.slice(0, 6).map((s) => (
              <button key={s.id} type="button" className="msr-btn" onClick={() => onOpen(s)}>
                <span className="msr-ico" style={{ background: s.color }}>
                  <s.Icon size={18} color="#fff" aria-hidden="true" />
                </span>
                <span className="msr-text">
                  <strong>{s.name}</strong>
                  <small>{s.label}</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            ))}
          </div>
        </>
      )}

      {byProduct.length > 0 && (
        <>
          <p className="msr-title">Tiendas con “{query}”</p>
          <div className="msr-list">
            {byProduct.slice(0, 8).map(({ store: s, products }) => (
              <button key={s.id} type="button" className="msr-btn" onClick={() => onOpen(s)}>
                <span className="msr-ico" style={{ background: s.color }}>
                  <s.Icon size={18} color="#fff" aria-hidden="true" />
                </span>
                <span className="msr-text">
                  <strong>{s.name}</strong>
                  <small>
                    {products.length === 1 ? products[0].name : `${products.length} productos: ${products.map((p) => p.name).join(', ')}`}
                  </small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            ))}
          </div>
        </>
      )}

      {loading && (
        <p className="msr-note">
          <Loader2 size={16} className="msr-spin" aria-hidden="true" /> Buscando productos…
        </p>
      )}
      {empty && (
        <p className="msr-note">
          <SearchX size={16} aria-hidden="true" /> No encontramos tiendas ni productos con “{query}”.
        </p>
      )}
    </div>
  );
}

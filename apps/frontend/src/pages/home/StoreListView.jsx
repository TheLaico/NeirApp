import { ChevronRight, Crown, MapPin, Star } from 'lucide-react';
import { formatDistance } from '../../features/stores/categories.jsx';
import './map-list.css';

/**
 * Las tiendas en vista de lista (alternativa al mapa): las mismas que se ven en el mapa, con la búsqueda y la
 * categoría aplicadas. Las recomendadas por el administrador van primero; después, las más cercanas.
 * `productsByStore` (id -> productos) muestra qué vende cada tienda de lo que se buscó.
 */
export default function StoreListView({ stores, status, productsByStore, onOpen, hidden }) {
  const rank = (s) => s.recommended_position ?? Infinity;
  const sorted = [...stores].sort((a, b) => rank(a) - rank(b) || a.distance - b.distance);
  return (
    <section className="map-list" aria-label="Tiendas en lista" aria-hidden={hidden || undefined} inert={hidden ? '' : undefined}>
      {status === 'loading' && <p className="map-list-empty">Cargando tiendas…</p>}
      {status === 'ok' && sorted.length === 0 && <p className="map-list-empty">No hay tiendas que coincidan.</p>}
      <ul className="map-list-grid">
        {sorted.map((s) => {
          const found = productsByStore?.get(s.id);
          return (
            <li key={s.id}>
              <button type="button" className="ml-card" onClick={() => onOpen(s)}>
                <span className="ml-logo" style={s.logo_url ? undefined : { background: s.color }}>
                  {s.logo_url ? <img src={s.logo_url} alt="" loading="lazy" /> : <s.Icon size={30} color="#fff" aria-hidden="true" />}
                </span>
                <span className="ml-info">
                  <span className="ml-name">
                    <strong>{s.name}</strong>
                    {s.recommended_position != null && (
                      <span className="ml-rec">
                        <Crown size={11} aria-hidden="true" /> Recomendado
                      </span>
                    )}
                  </span>
                  <span className="ml-cat">{s.label}</span>
                  {found?.length > 0 && <span className="ml-found">Tiene: {found.map((p) => p.name).join(', ')}</span>}
                  <span className="ml-meta">
                    {s.rating ? (
                      <span>
                        <Star size={14} fill="#F2A81D" color="#F2A81D" aria-hidden="true" /> {s.rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="ml-new">Nueva</span>
                    )}
                    <span>
                      <MapPin size={14} aria-hidden="true" /> {formatDistance(s.distance)}
                    </span>
                    <span className={`ml-open${s.is_open === false ? ' closed' : ''}`}>{s.is_open === false ? 'Cerrada' : 'Abierta'}</span>
                  </span>
                </span>
                <ChevronRight size={20} className="ml-chev" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

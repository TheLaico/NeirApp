import { ArrowRight, ChevronRight, MapPin, Star } from 'lucide-react';
import { formatDistance } from '../../features/stores/categories.jsx';
import banner from '../../assets/tienda-banner.png';
import StoreDetail from './StoreDetail.jsx';

function StoreCard({ store, onSelect }) {
  const { Icon } = store;
  return (
    <button type="button" className="store-card" onClick={() => onSelect(store)}>
      <span className="store-ico" style={{ background: store.color }}>
        <Icon size={34} color="#fff" aria-hidden="true" />
      </span>
      <span className="store-info">
        <strong>{store.name}</strong>
        <span className="store-cat">{store.label}</span>
        <span className="store-meta">
          {store.rating != null && (
            <span>
              <Star size={15} fill="#F2A81D" color="#F2A81D" aria-hidden="true" />
              {store.rating} ({store.reviews})
            </span>
          )}
          <span>
            <MapPin size={15} fill="currentColor" aria-hidden="true" />
            {formatDistance(store.distance)}
          </span>
        </span>
      </span>
      <ChevronRight size={20} aria-hidden="true" className="store-chev" />
    </button>
  );
}

/** Banner "Tu tienda también en NeirAPP": la imagen ya trae el texto y el botón. */
function Promo() {
  return (
    <button type="button" className="promo-banner" aria-label="Tu tienda también en NeirAPP. Registra tu tienda">
      <img src={banner} alt="" />
    </button>
  );
}

export default function StorePanel({
  stores,
  onSelect,
  status,
  selected,
  onBack,
  selectedProductId,
  onOpenProduct,
  overlayOpen,
  onOpenInfo,
}) {
  if (selected) {
    return (
      <StoreDetail
        store={selected}
        onBack={onBack}
        selectedProductId={selectedProductId}
        onOpenProduct={onOpenProduct}
        overlayOpen={overlayOpen}
        onOpenInfo={onOpenInfo}
      />
    );
  }

  return (
    <aside className="panel has-banner" aria-label="Tiendas cercanas">
      <div className="panel-head">
        <h2>Tiendas cercanas</h2>
        <button type="button" className="see-all">
          Ver todas <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="store-list">
        {status === 'loading' && <p className="panel-empty">Cargando tiendas…</p>}
        {status === 'error' && (
          <p className="panel-empty" role="alert">
            No se pudo conectar con el servidor. Intenta de nuevo más tarde.
          </p>
        )}
        {status === 'ok' && stores.length === 0 && (
          <p className="panel-empty">Todavía no hay tiendas para mostrar.</p>
        )}
        {stores.map((s) => (
          <StoreCard key={s.id} store={s} onSelect={onSelect} />
        ))}
      </div>

      <Promo />
    </aside>
  );
}

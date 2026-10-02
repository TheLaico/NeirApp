import { ArrowRight, ChevronRight, MapPin, Star } from 'lucide-react';
import { useState } from 'react';
import MerchantLeadModal from '../../features/leads/MerchantLeadModal.jsx';
import { formatDistance } from '../../features/stores/categories.jsx';
import banner from '../../assets/tienda-banner.png';
import StoreDetail from './StoreDetail.jsx';

function StoreCard({ store, onSelect }) {
  const { Icon } = store;
  return (
    <button type="button" className="store-card" onClick={() => onSelect(store)}>
      {/* El logo que sube el comerciante en "Mi tienda"; sin logo, el ícono y el color de su categoría. */}
      {store.logo_url ? (
        <img className="store-ico store-logo" src={store.logo_url} alt="" loading="lazy" />
      ) : (
        <span className="store-ico" style={{ background: store.color }}>
          <Icon size={34} color="#fff" aria-hidden="true" />
        </span>
      )}
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
function Promo({ user }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="promo-banner" aria-label="Tu tienda también en NeirAPP. Deja tus datos para que un asesor te contacte" onClick={() => setOpen(true)}>
        <img src={banner} alt="" />
      </button>
      {open && <MerchantLeadModal onClose={() => setOpen(false)} defaultName={user?.name ?? ''} />}
    </>
  );
}

export default function StorePanel({
  user,
  stores,
  onSelect,
  status,
  selected,
  onBack,
  selectedProductId,
  onOpenProduct,
  overlayOpen,
  onOpenInfo,
  // Búsqueda del mapa: con algo escrito se listan todas las tiendas que coinciden (no solo las recomendadas), y al
  // abrir una tienda que vende lo buscado su catálogo llega filtrado por `detailQuery`.
  searchLabel = '',
  detailQuery = '',
}) {
  const [showAll, setShowAll] = useState(false);

  if (selected) {
    return (
      <StoreDetail
        key={`${selected.id}|${detailQuery}`}
        store={selected}
        initialQuery={detailQuery}
        onBack={onBack}
        selectedProductId={selectedProductId}
        onOpenProduct={onOpenProduct}
        overlayOpen={overlayOpen}
        onOpenInfo={onOpenInfo}
      />
    );
  }

  // Por defecto se ven las tiendas recomendadas, en el orden que decide el administrador. "Ver todas" muestra el resto.
  const recommended = stores.filter((s) => s.recommended_position != null).sort((a, b) => a.recommended_position - b.recommended_position);
  const hasRecommended = recommended.length > 0;
  const list = showAll || !hasRecommended || searchLabel ? stores : recommended;
  const title = searchLabel ? `Resultados de “${searchLabel}”` : showAll || !hasRecommended ? 'Todas las tiendas' : 'Tiendas recomendadas';

  return (
    <aside className="panel has-banner" aria-label={title}>
      <div className="panel-head">
        <h2>{title}</h2>
        {hasRecommended && !searchLabel && (
          <button type="button" className="see-all" onClick={() => setShowAll((v) => !v)} aria-pressed={showAll}>
            {showAll ? 'Ver recomendadas' : 'Ver todas'} <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="store-list">
        {status === 'loading' && <p className="panel-empty">Cargando tiendas…</p>}
        {status === 'error' && (
          <p className="panel-empty" role="alert">
            No se pudo conectar con el servidor. Intenta de nuevo más tarde.
          </p>
        )}
        {status === 'ok' && stores.length === 0 && (
          <p className="panel-empty">{searchLabel ? `Ninguna tienda tiene “${searchLabel}”.` : 'Todavía no hay tiendas para mostrar.'}</p>
        )}
        {list.map((s) => (
          <StoreCard key={s.id} store={s} onSelect={onSelect} />
        ))}
      </div>

      <Promo user={user} />
    </aside>
  );
}

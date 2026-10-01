import { ArrowLeft, Clock, MapPin, ShoppingBag, Truck } from 'lucide-react';
import { useEffect } from 'react';
import { useStoreReviews } from '../../features/reviews/api.js';
import { formatDistance } from '../../features/stores/categories.jsx';
import { useStoreSchedule } from '../../features/stores/api.js';
import { CLOSED_REASON_CUSTOMER, DAYS, formatDay, formatTime, nextOpenText, toInputTime } from '../../features/stores/schedule.js';
import CompactModal, { isCompactScreen } from './CompactModal.jsx';
import Stars from './Stars.jsx';

const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Pantalla "Ver tienda": foto, descripción, calificación y reseñas de la tienda.
 * Usa los mismos estilos que la pantalla de producto (entra desde el borde derecho del mapa).
 */
export default function StoreScreen({ store, onClose }) {
  const { Icon } = store;
  const compact = isCompactScreen();
  const { summary, reviews, status } = useStoreReviews(store.id);
  const schedule = useStoreSchedule(store.id);
  // 0 = lunes … 6 = domingo, como el servidor.
  const today = (new Date().getDay() + 6) % 7;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hasReviews = status === 'ok' && summary?.count > 0;

  return (
    <CompactModal compact={compact} onClose={onClose}>
    <section className={`product-screen${compact ? ' as-modal' : ''}`} aria-label={`Información de ${store.name}`}>
      <div className="ps-scroll">
        {/* El backend todavía no guarda fotos de tiendas: sin foto se muestra una portada con el color e icono de su categoría. */}
        <div className="ps-art" style={{ '--tint': store.color }}>
          {store.image_url ? (
            <img src={store.image_url} alt={`Foto de ${store.name}`} />
          ) : (
            <Icon size={88} color="#fff" aria-hidden="true" />
          )}
          <button type="button" className="ps-back" aria-label="Cerrar información de la tienda" onClick={onClose}>
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
        </div>

        <div className="ps-body">
          <span className="ps-cat">{store.label}</span>
          <h2>{store.name}</h2>

          <div className="ps-rating">
            {hasReviews ? (
              <>
                <Stars value={summary.average} />
                <strong>{summary.average.toFixed(1)}</strong>
                <span>
                  ({summary.count} {summary.count === 1 ? 'reseña' : 'reseñas'})
                </span>
              </>
            ) : (
              <span>{status === 'loading' ? 'Cargando calificación…' : 'Aún sin calificaciones'}</span>
            )}
          </div>

          <h3>Acerca de la tienda</h3>
          <p className="ps-desc">{store.description?.trim() || 'Esta tienda todavía no tiene descripción.'}</p>

          <ul className="ps-facts">
            <li>
              <Clock size={18} aria-hidden="true" />
              <span>
                {store.is_open === false
                  ? `${CLOSED_REASON_CUSTOMER[store.closed_reason] ?? 'Cerrada por ahora'}${store.next_open_at ? ` · abre ${nextOpenText(store.next_open_at)}` : ''}`
                  : 'Abierta ahora'}
              </span>
            </li>
            <li>
              <MapPin size={18} aria-hidden="true" />
              <span>A {formatDistance(store.distance)} del centro de Neira</span>
            </li>
            <li>
              <Truck size={18} aria-hidden="true" />
              <span>Entrega a domicilio solo en Neira, Caldas</span>
            </li>
          </ul>

          {schedule?.has_hours && (
            <>
              <h3>Horario</h3>
              {schedule.is_24_7 ? (
                <p className="ps-open247">Abierto las 24 horas, todos los días</p>
              ) : (
              <ul className="ps-hours">
                {schedule.days.map((d) => (
                  <li key={d.weekday} className={d.weekday === today ? 'today' : ''}>
                    <span>{DAYS[d.weekday]}</span>
                    <span>{!d.is_open ? 'Cerrado' : d.all_day ? 'Las 24 horas' : `${formatTime(toInputTime(d.opens))} – ${formatTime(toInputTime(d.closes))}`}</span>
                  </li>
                ))}
              </ul>
              )}
              {schedule.closed_dates.length > 0 && (
                <p className="ps-empty">
                  No abre: {schedule.closed_dates.slice(0, 3).map((c) => `${formatDay(c.day)}${c.reason ? ` (${c.reason})` : ''}`).join(', ')}
                </p>
              )}
            </>
          )}

          <h3>Reseñas{hasReviews ? ` (${summary.count})` : ''}</h3>
          {status === 'ok' && reviews.length === 0 && <p className="ps-empty">Todavía nadie ha calificado esta tienda.</p>}
          {status === 'error' && <p className="ps-empty">No se pudieron cargar las reseñas.</p>}
          <ul className="ps-reviews">
            {reviews.map((r) => (
              <li key={r.id}>
                <div>
                  <Stars value={r.rating} size={15} />
                  <time dateTime={r.created_at}>{dateFormat.format(new Date(r.created_at))}</time>
                </div>
                {r.comment && <p>{r.comment}</p>}
                {r.merchant_reply && (
                  <p className="ps-reply">
                    <strong>Respuesta de {store.name}</strong>
                    {r.merchant_reply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="ps-foot">
        <button type="button" className="ps-add" onClick={onClose}>
          <ShoppingBag size={19} aria-hidden="true" />
          Ver productos de la tienda
        </button>
      </footer>
    </section>
    </CompactModal>
  );
}

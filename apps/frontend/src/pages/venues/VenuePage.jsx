import { ArrowLeft, CalendarCheck, Clock, Heart, Images, Loader2, MapPin, MessageCircle, Navigation, Phone, Share2, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import Lightbox from '../../components/common/Lightbox.jsx';
import PageShell from '../../components/layout/PageShell.jsx';
import { directionsLink, phoneLabel } from '../../features/lodging/model.js';
import { venuesApi } from '../../features/venues/api.js';
import { DAYS, featuresOf, markerOf, priceLabel, telLink, timeLabel, useVenueFavorites, whatsappLink } from '../../features/venues/model.js';
import { useNavigate } from '../../lib/router.jsx';
import HotelsMap from '../lodging/HotelsMap.jsx';
import { ReviewItem } from '../lodging/LodgingPage.jsx';
import { RatingLine, Stars, StarsInput } from '../lodging/Stars.jsx';
import '../lodging/lodging.css';
import BookingDialog from './BookingDialog.jsx';
import { CategoryChip } from './VenuesPage.jsx';
import './venues.css';

/**
 * Un lugar de Reservas: fotos, horario, qué ofrece, dónde queda (en el mapa de Neira), cómo contactarlo, la reserva y
 * todas sus opiniones, con la respuesta del lugar. Aquí se califica. La ruta es /reservas/lugar?id=<id>.
 */
export default function VenuePage({ user, onLogout }) {
  const navigate = useNavigate();
  const [id] = useState(() => new URLSearchParams(window.location.search).get('id'));
  const [state, setState] = useState({ hotel: null, loading: true, error: '' });
  const [reviews, setReviews] = useState([]);
  const [viewer, setViewer] = useState(null);
  const [booking, setBooking] = useState(false);
  const [copied, setCopied] = useState(false);
  const favorites = useVenueFavorites();

  const load = useCallback(async () => {
    try {
      const [hotel, list] = await Promise.all([venuesApi.get(id), venuesApi.reviews(id)]);
      setState({ hotel, loading: false, error: '' });
      setReviews(list);
    } catch (err) {
      setState({ hotel: null, loading: false, error: err.status === 404 || err.status === 422 ? 'Este lugar ya no está disponible.' : err.message });
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  // Desde "Ver todas" llega con #opiniones.
  useEffect(() => {
    if (!state.hotel || window.location.hash !== '#opiniones') return;
    setTimeout(() => document.getElementById('opiniones')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }, [state.hotel]);

  const h = state.hotel;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: h.name, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      /* el usuario canceló */
    }
  };

  const onRated = (review) => {
    setReviews((list) => [review, ...list.filter((r) => r.id !== review.id)]);
    venuesApi.get(id).then((hotel) => setState((s) => ({ ...s, hotel }))).catch(() => {});
  };

  return (
    <PageShell user={user} onLogout={onLogout} flush className="lg-view">
      <div className="lg-page">
        <button type="button" className="lg-back" onClick={() => navigate('/reservas')}>
          <ArrowLeft size={18} aria-hidden="true" /> Volver a Reservas
        </button>

        {state.loading ? (
          <p className="lg-empty">Cargando…</p>
        ) : state.error ? (
          <div className="lg-empty">
            <p role="alert">{state.error}</p>
            <button type="button" className="lg-btn outline" onClick={() => navigate('/reservas')}>
              Ver otros lugares
            </button>
          </div>
        ) : (
          <article className="lgd">
            <div className={`lgd-gallery n${Math.min(h.photos.length, 5)}`}>
              {h.photos.slice(0, 5).map((url, n) => (
                <button key={url} type="button" onClick={() => setViewer(n)} aria-label={`Ver foto ${n + 1}`}>
                  <img src={url} alt={n === 0 ? `Foto de ${h.name}` : ''} />
                  {n === 4 && h.photos.length > 5 && <span>+{h.photos.length - 5}</span>}
                </button>
              ))}
              <button type="button" className="lgd-all" onClick={() => setViewer(0)}>
                <Images size={16} aria-hidden="true" /> {h.photos.length === 1 ? '1 foto' : `${h.photos.length} fotos`}
              </button>
            </div>

            <header className="lgd-head">
              <div>
                <span className="vnd-chips">
                  <CategoryChip category={h.category} />
                  {h.is_featured && <span className="lg-badge inline">Destacado</span>}
                </span>
                <h1>{h.name}</h1>
                {h.tagline && <p className="lgd-tagline">{h.tagline}</p>}
                <RatingLine hotel={h} size={17} />
                <p className="lg-address">
                  <MapPin size={16} aria-hidden="true" /> {h.address}
                </p>
              </div>
              <div className="lgd-head-actions">
                <button type="button" className={`lg-icon-btn${favorites.has(h.id) ? ' on' : ''}`} aria-pressed={favorites.has(h.id)} onClick={() => favorites.toggle(h.id)}>
                  <Heart size={18} aria-hidden="true" fill={favorites.has(h.id) ? 'currentColor' : 'none'} /> {favorites.has(h.id) ? 'Guardado' : 'Guardar'}
                </button>
                <button type="button" className="lg-icon-btn" onClick={share}>
                  <Share2 size={18} aria-hidden="true" /> {copied ? 'Enlace copiado' : 'Compartir'}
                </button>
              </div>
            </header>

            <div className="lgd-body">
              <div className="lgd-main">
                <section className="lgd-card">
                  <h2>Sobre el lugar</h2>
                  <p className="lgd-desc">{h.description}</p>
                  <ul className="lgd-times">
                    <li>
                      <Users size={17} aria-hidden="true" /> Hasta <strong>{h.max_people}</strong> personas por reserva
                    </li>
                  </ul>
                </section>

                <section className="lgd-card">
                  <h2>
                    <Clock size={18} aria-hidden="true" /> Horario
                  </h2>
                  <ul className="vnd-hours">
                    {DAYS.map((d, n) => (
                      <li key={d} className={h.open_days.includes(n) ? '' : 'off'}>
                        {d}
                        <small>{h.open_days.includes(n) ? `${timeLabel(h.open_time)} – ${timeLabel(h.close_time)}` : 'Cerrado'}</small>
                      </li>
                    ))}
                  </ul>
                </section>

                {h.features.length > 0 && (
                  <section className="lgd-card">
                    <h2>Servicios</h2>
                    <ul className="lgd-amenities">
                      {featuresOf(h.features).map(({ id: key, label, Icon }) => (
                        <li key={key}>
                          <Icon size={20} aria-hidden="true" /> {label}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="lgd-card">
                  <div className="lgd-card-head">
                    <h2>Ubicación</h2>
                    <a className="lg-btn primary small" href={directionsLink(h)} target="_blank" rel="noreferrer">
                      <Navigation size={15} aria-hidden="true" /> Cómo llegar
                    </a>
                  </div>
                  <p className="lg-address">
                    <MapPin size={16} aria-hidden="true" /> {h.address}
                  </p>
                  <HotelsMap hotels={[h]} selectedId={h.id} className="lgd-map" markerOf={markerOf} allLabel="Centrar el lugar" />
                </section>

                <Reviews user={user} hotel={h} reviews={reviews} onRated={onRated} />
              </div>

              <aside className="lgd-side">
                <div className="lgd-book">
                  <p className="lg-price">
                    <strong>{priceLabel(h)}</strong>
                  </p>
                  <button type="button" className="lg-btn primary wide" onClick={() => setBooking(true)}>
                    <CalendarCheck size={18} aria-hidden="true" /> Reservar
                  </button>
                  {h.whatsapp && (
                    <a className="lg-btn whatsapp wide" href={whatsappLink(h.whatsapp, h.name)} target="_blank" rel="noreferrer">
                      <MessageCircle size={18} aria-hidden="true" /> WhatsApp {phoneLabel(h.whatsapp)}
                    </a>
                  )}
                  <a className="lg-btn outline wide" href={directionsLink(h)} target="_blank" rel="noreferrer">
                    <Navigation size={18} aria-hidden="true" /> Cómo llegar
                  </a>
                  <a className="lg-btn outline wide" href={telLink(h.phone)}>
                    <Phone size={18} aria-hidden="true" /> Llamar {phoneLabel(h.phone)}
                  </a>
                  {h.email && (
                    <a className="lg-link center" href={`mailto:${h.email}`}>
                      {h.email}
                    </a>
                  )}
                  <small className="lg-muted">La reserva la confirma el lugar. Si hay que pagar algo se acuerda directamente con ellos; NeirAPP no cobra.</small>
                </div>
              </aside>
            </div>
          </article>
        )}
      </div>
      {viewer !== null && h && <Lightbox images={h.photos.map((url, n) => ({ id: n, url, caption: h.name }))} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />}
      {booking && h && <BookingDialog user={user} venue={h} onClose={() => setBooking(false)} onDone={() => navigate('/reservas/mis-reservas')} />}
    </PageShell>
  );
}

/** Resumen (promedio y barras por estrellas), el formulario para calificar y todas las opiniones. */
function Reviews({ user, hotel, reviews, onRated }) {
  const mine = reviews.find((r) => r.user_id === user.id);
  const own = hotel.id === user.id;
  const [stars, setStars] = useState(mine?.stars ?? 0);
  const [comment, setComment] = useState(mine?.comment ?? '');
  const [editing, setEditing] = useState(!mine);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const counts = [5, 4, 3, 2, 1].map((n) => reviews.filter((r) => r.stars === n).length);

  const submit = async (e) => {
    e.preventDefault();
    if (!stars) return setError('Elige de 1 a 5 estrellas.');
    setBusy(true);
    setError('');
    try {
      onRated(await venuesApi.rate(hotel.id, stars, comment.trim()));
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="lgd-card" id="opiniones" aria-labelledby="lgd-op">
      <h2 id="lgd-op">Opiniones de los clientes</h2>
      {reviews.length > 0 && (
        <div className="lgd-score">
          <div className="lgd-score-big">
            <strong>{hotel.rating.toLocaleString('es-CO', { minimumFractionDigits: 1 })}</strong>
            <Stars value={hotel.rating} size={18} />
            <span>{hotel.reviews_count === 1 ? '1 reseña' : `${hotel.reviews_count} reseñas`}</span>
          </div>
          <ul className="lgd-bars">
            {counts.map((count, n) => (
              <li key={5 - n}>
                <span>{5 - n} ★</span>
                <span className="lgd-bar">
                  <span style={{ width: `${(count / reviews.length) * 100}%` }} />
                </span>
                <span>{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!own &&
        (editing ? (
          <form className="lgd-rate" onSubmit={submit}>
            <h3>{mine ? 'Edita tu calificación' : '¿Ya fuiste? Califica este lugar'}</h3>
            <StarsInput value={stars} onChange={(n) => (setStars(n), setError(''))} />
            <textarea rows={3} maxLength={500} value={comment} placeholder="Cuéntale a otros cómo te fue (opcional)" onChange={(e) => setComment(e.target.value)} />
            {error && (
              <p className="lg-error" role="alert">
                {error}
              </p>
            )}
            <div className="lgd-rate-actions">
              {mine && (
                <button type="button" className="lg-btn outline" onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              )}
              <button type="submit" className="lg-btn primary" disabled={busy}>
                {busy && <Loader2 size={16} className="lg-spin" aria-hidden="true" />} {mine ? 'Guardar cambios' : 'Publicar opinión'}
              </button>
            </div>
          </form>
        ) : (
          <p className="lgd-rated" role="status">
            {saved ? '¡Gracias! Tu opinión ya está publicada.' : 'Ya calificaste este lugar.'}{' '}
            <button type="button" className="lg-link" onClick={() => (setEditing(true), setSaved(false))}>
              Editar mi opinión
            </button>
          </p>
        ))}

      {reviews.length === 0 ? (
        <p className="lg-muted">Todavía no hay opiniones. {own ? '' : '¡Sé el primero en calificar!'}</p>
      ) : (
        <ul className="lg-review-list">
          {reviews.map((r) => (
            <li key={r.id}>
              <ReviewItem review={r} hotelName={hotel.name} mine={r.user_id === user.id} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

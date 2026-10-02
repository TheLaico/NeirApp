import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Clock, Eye, Heart, List, Map as MapIcon, MapPin, MessageCircle, Navigation, Settings, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import fondoBuscador from '../../assets/fondo-buscador.png';
import Lightbox from '../../components/common/Lightbox.jsx';
import PageShell from '../../components/layout/PageShell.jsx';
import { directionsLink } from '../../features/lodging/model.js';
import { venuesApi } from '../../features/venues/api.js';
import { CATEGORIES, categoryOf, contactLink, featuresOf, markerOf, priceLabel, scheduleLabel, unitLabel, useVenueFavorites } from '../../features/venues/model.js';
import { formatCop } from '../../lib/money.js';
import { useNavigate } from '../../lib/router.jsx';
import { useMediaQuery } from '../../lib/useMediaQuery.js';
import HotelsMap from '../lodging/HotelsMap.jsx';
import { AmenityIcons, ReviewItem } from '../lodging/LodgingPage.jsx';
import { RatingLine } from '../lodging/Stars.jsx';
import '../lodging/lodging.css';
import BookingDialog from './BookingDialog.jsx';
import './venues.css';

const DESKTOP = '(min-width: 1180px)';
const normalize = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const venuePath = (id) => `/reservas/lugar?id=${id}`;

/**
 * Reservas: restaurantes, canchas, salones de eventos y demás lugares de Neira que se reservan. Igual que Hospedaje:
 * arriba los destacados (los elige el administrador), la lista o el mapa (el mismo del inicio, solo con estos
 * lugares, cada uno con el color de su tipo) y, en computador, la ficha del lugar elegido con sus opiniones.
 */
export default function VenuesPage({ user, onLogout }) {
  const navigate = useNavigate();
  const desktop = useMediaQuery(DESKTOP);
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [mode, setMode] = useState('list');
  const [selectedId, setSelectedId] = useState(null);
  const [focusKey, setFocusKey] = useState(0);
  const [booking, setBooking] = useState(null);
  const favorites = useVenueFavorites();
  const isOwner = user.roles?.includes('venue');

  const load = useCallback(async () => {
    try {
      setState({ list: await venuesApi.list(), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const present = useMemo(() => CATEGORIES.filter((c) => state.list.some((v) => v.category === c.id)), [state.list]);
  const shown = useMemo(() => {
    const q = normalize(query.trim());
    return state.list.filter((v) => (category === 'all' || v.category === category) && (!q || normalize(`${v.name} ${v.tagline} ${v.address} ${v.description}`).includes(q)));
  }, [state.list, query, category]);
  const featured = state.list.filter((v) => v.is_featured);
  const selected = shown.find((v) => v.id === selectedId) ?? null;

  useEffect(() => {
    if (desktop && shown.length && !shown.some((v) => v.id === selectedId)) setSelectedId(shown[0].id);
  }, [desktop, shown, selectedId]);

  const showOnMap = (id) => {
    setSelectedId(id);
    setMode('map');
    setFocusKey((k) => k + 1);
  };

  const listBody = state.loading ? (
    <p className="lg-empty">Cargando lugares…</p>
  ) : state.error ? (
    <div className="lg-empty">
      <p role="alert">{state.error}</p>
      <button type="button" className="lg-btn outline" onClick={load}>
        Reintentar
      </button>
    </div>
  ) : shown.length === 0 ? (
    <div className="lg-empty">
      <CalendarDays size={40} aria-hidden="true" />
      <p>{state.list.length ? 'No hay lugares que coincidan con tu búsqueda.' : 'Muy pronto verás aquí los lugares de Neira que puedes reservar.'}</p>
    </div>
  ) : null;

  const detail = selected && (
    <>
      <VenueCard
        venue={selected}
        favorite={favorites.has(selected.id)}
        onFavorite={() => favorites.toggle(selected.id)}
        onMap={() => showOnMap(selected.id)}
        onBook={() => setBooking(selected)}
        onOpen={() => navigate(venuePath(selected.id))}
      />
      <ReviewsPreview venue={selected} onAll={() => navigate(`${venuePath(selected.id)}#opiniones`)} />
    </>
  );

  return (
    <PageShell user={user} onLogout={onLogout} query={query} onQuery={setQuery} flush heroImage={fondoBuscador} centerLogo className="lg-view vn-view">
      <div className="lg-page">
        <div className={`lg-layout ${mode}`}>
          <div className="lg-main">
            {featured.length > 0 && <Featured venues={featured} onOpen={(v) => navigate(venuePath(v.id))} />}

            <header className="lg-head">
              <div>
                <h1>Reservas en Neira</h1>
                <p>Reserva tu mesa, cancha o salón en los mejores lugares del pueblo</p>
              </div>
              <div className="lg-head-actions">
                <button type="button" className="lg-link" onClick={() => navigate('/reservas/mis-reservas')}>
                  <CalendarCheck size={17} aria-hidden="true" /> Mis reservas
                </button>
                {isOwner && (
                  <button type="button" className="lg-link" onClick={() => navigate('/establecimiento')}>
                    <Settings size={17} aria-hidden="true" /> Mi lugar
                  </button>
                )}
                <div className="lg-toggle" role="group" aria-label="Ver como">
                  <button type="button" className={mode === 'list' ? 'on' : ''} aria-pressed={mode === 'list'} onClick={() => setMode('list')}>
                    <List size={17} aria-hidden="true" /> Lista
                  </button>
                  <button type="button" className={mode === 'map' ? 'on' : ''} aria-pressed={mode === 'map'} onClick={() => setMode('map')}>
                    <MapIcon size={17} aria-hidden="true" /> Mapa
                  </button>
                </div>
              </div>
            </header>

            {present.length > 1 && (
              <div className="lg-kinds" role="toolbar" aria-label="Tipo de lugar">
                <button type="button" className={category === 'all' ? 'on' : ''} aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
                  Todos
                </button>
                {present.map(({ id, label, Icon, color }) => (
                  <button key={id} type="button" className={category === id ? 'on' : ''} aria-pressed={category === id} onClick={() => setCategory(id)}>
                    <Icon size={16} aria-hidden="true" style={{ color }} /> {label}
                  </button>
                ))}
              </div>
            )}

            {listBody ??
              (mode === 'list' ? (
                <ul className="lg-list">
                  {shown.map((v) => (
                    <li key={v.id}>
                      <VenueRow
                        venue={v}
                        active={desktop && v.id === selected?.id}
                        onSelect={() => (desktop ? setSelectedId(v.id) : navigate(venuePath(v.id)))}
                        onOpen={() => navigate(venuePath(v.id))}
                        onBook={() => setBooking(v)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <HotelsMap hotels={shown} selectedId={selected?.id} onSelect={setSelectedId} onList={() => setMode('list')} focusKey={focusKey} className="big" markerOf={markerOf} allLabel="Ver todos los lugares" />
                  {!desktop && (selected ? <div className="lg-map-detail">{detail}</div> : <p className="lg-map-hint">Toca un lugar en el mapa para ver su información.</p>)}
                </>
              ))}
          </div>

          {desktop && (
            <aside className="lg-side" aria-label="Lugar elegido">
              {mode === 'list' && shown.length > 0 && <HotelsMap hotels={shown} selectedId={selected?.id} onSelect={setSelectedId} focusKey={focusKey} markerOf={markerOf} allLabel="Ver todos los lugares" />}
              {detail}
            </aside>
          )}
        </div>
      </div>
      {booking && <BookingDialog user={user} venue={booking} onClose={() => setBooking(null)} onDone={() => navigate('/reservas/mis-reservas')} />}
    </PageShell>
  );
}

/** "Lugares destacados": banner por lugar con su fondo, pasa solo cada 7 segundos. */
function Featured({ venues, onOpen }) {
  const [index, setIndex] = useState(0);
  const count = venues.length;
  const current = venues[index % count];
  useEffect(() => {
    if (count < 2) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 7000);
    return () => clearInterval(timer);
  }, [count, index]);
  const background = current.banner_url || current.photos[0];
  const cat = categoryOf(current.category);

  return (
    <section className="lg-reco" aria-labelledby="vn-reco-title" aria-roledescription="carrusel">
      <h2 id="vn-reco-title" className="lg-section-title">
        Lugares destacados
      </h2>
      <article className="lg-reco-card" aria-roledescription="diapositiva" aria-label={`${(index % count) + 1} de ${count}`}>
        {background && <img key={background} src={background} alt="" className="lg-reco-bg" />}
        <span className="lg-badge">
          <Star size={13} fill="currentColor" aria-hidden="true" /> Destacado
        </span>
        <div className="lg-reco-text">
          <span className="vn-cat on-dark">
            <cat.Icon size={14} aria-hidden="true" /> {cat.one}
          </span>
          <h3>{current.name}</h3>
          {current.tagline && <p>{current.tagline}</p>}
          <RatingLine hotel={current} size={17} />
          <button type="button" className="lg-btn primary" onClick={() => onOpen(current)}>
            Ver y reservar
          </button>
        </div>
        {count > 1 && (
          <>
            <button type="button" className="lg-reco-arrow prev" aria-label="Anterior" onClick={() => setIndex((i) => (i - 1 + count) % count)}>
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button type="button" className="lg-reco-arrow next" aria-label="Siguiente" onClick={() => setIndex((i) => (i + 1) % count)}>
              <ChevronRight size={22} aria-hidden="true" />
            </button>
            <div className="lg-dots">
              {venues.map((v, n) => (
                <button key={v.id} type="button" className={n === index % count ? 'on' : ''} aria-label={`Ver ${v.name}`} onClick={() => setIndex(n)} />
              ))}
            </div>
          </>
        )}
      </article>
    </section>
  );
}

export function CategoryChip({ category }) {
  const cat = categoryOf(category);
  return (
    <span className="vn-cat" style={{ '--c': cat.color }}>
      <cat.Icon size={13} aria-hidden="true" /> {cat.one}
    </span>
  );
}

function VenueRow({ venue: v, active, onSelect, onOpen, onBook }) {
  return (
    <article className={`lg-row${active ? ' active' : ''}`}>
      <button type="button" className="lg-row-photo" onClick={onSelect} aria-label={`Ver ${v.name}`}>
        {v.photos[0] && <img src={v.photos[0]} alt="" loading="lazy" />}
        {v.is_featured && <span className="lg-badge small">Destacado</span>}
      </button>
      <div className="lg-row-info">
        <CategoryChip category={v.category} />
        <h3>
          <button type="button" onClick={onSelect}>
            {v.name}
          </button>
        </h3>
        <p className="lg-address">
          <MapPin size={15} aria-hidden="true" /> {v.address}
        </p>
        <p className="lg-address vn-hours">
          <Clock size={15} aria-hidden="true" /> {scheduleLabel(v)}
        </p>
        <RatingLine hotel={v} size={14} />
        <AmenityIcons items={featuresOf(v.features)} max={5} />
      </div>
      <div className="lg-row-side">
        <p className="lg-price">
          {v.price_cop ? (
            <>
              <small>Desde</small>
              <strong>{formatCop(v.price_cop)}</strong>
              <small>{unitLabel(v)}</small>
            </>
          ) : (
            <strong className="vn-ask">Precio a consultar</strong>
          )}
        </p>
        <button type="button" className="lg-btn primary" onClick={onBook}>
          <CalendarCheck size={16} aria-hidden="true" /> Reservar
        </button>
        <button type="button" className="lg-btn outline" onClick={onOpen}>
          <Eye size={16} aria-hidden="true" /> Ver detalles
        </button>
      </div>
    </article>
  );
}

/** La ficha del lugar elegido (a la derecha en computador, debajo del mapa en celular). */
function VenueCard({ venue: v, favorite, onFavorite, onMap, onBook, onOpen }) {
  const [viewer, setViewer] = useState(null);
  const thumbs = v.photos.slice(1, 5);
  const extra = v.photos.length - 5;
  return (
    <article className="lg-card">
      <div className="lg-card-photo">
        <button type="button" className="lg-card-main" onClick={() => setViewer(0)} aria-label="Ver fotos en grande">
          {v.photos[0] && <img src={v.photos[0]} alt={`Foto de ${v.name}`} />}
        </button>
        <button type="button" className={`lg-heart${favorite ? ' on' : ''}`} aria-pressed={favorite} aria-label={favorite ? 'Quitar de guardados' : 'Guardar'} onClick={onFavorite}>
          <Heart size={20} aria-hidden="true" fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      {thumbs.length > 0 && (
        <ul className="lg-thumbs">
          {thumbs.map((url, n) => (
            <li key={url}>
              <button type="button" onClick={() => setViewer(n + 1)} aria-label={`Foto ${n + 2}`}>
                <img src={url} alt="" loading="lazy" />
                {n === thumbs.length - 1 && extra > 0 && <span>+{extra}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="lg-card-body">
        <CategoryChip category={v.category} />
        <h2>
          <button type="button" onClick={onOpen}>
            {v.name}
          </button>
        </h2>
        <RatingLine hotel={v} />
        <p className="lg-address">
          <MapPin size={15} aria-hidden="true" /> {v.address}
        </p>
        <p className="lg-address vn-hours">
          <Clock size={15} aria-hidden="true" /> {scheduleLabel(v)}
        </p>
        <p className="lg-card-desc">{v.description}</p>
        <AmenityIcons items={featuresOf(v.features)} max={6} />
        <p className="lg-price inline">
          <strong>{priceLabel(v)}</strong>
        </p>
        <div className="lg-card-actions">
          <button type="button" className="lg-btn outline" onClick={onMap}>
            <MapPin size={16} aria-hidden="true" /> Ver en el mapa
          </button>
          <a className="lg-btn outline" href={directionsLink(v)} target="_blank" rel="noreferrer">
            <Navigation size={16} aria-hidden="true" /> Cómo llegar
          </a>
          <a className="lg-btn outline" href={contactLink(v)} target="_blank" rel="noreferrer">
            <MessageCircle size={16} aria-hidden="true" /> Contactar
          </a>
          <button type="button" className="lg-btn primary" onClick={onBook}>
            <CalendarCheck size={16} aria-hidden="true" /> Reservar
          </button>
        </div>
      </div>
      {viewer !== null && <Lightbox images={v.photos.map((url, n) => ({ id: n, url, caption: v.name }))} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />}
    </article>
  );
}

function ReviewsPreview({ venue, onAll }) {
  const [reviews, setReviews] = useState(null);
  useEffect(() => {
    let alive = true;
    setReviews(null);
    venuesApi
      .reviews(venue.id)
      .then((list) => alive && setReviews(list))
      .catch(() => alive && setReviews([]));
    return () => {
      alive = false;
    };
  }, [venue.id]);

  return (
    <section className="lg-opinions" aria-labelledby="vn-op-title">
      <div className="lg-opinions-head">
        <h2 id="vn-op-title">Opiniones de los clientes</h2>
        <button type="button" className="lg-link" onClick={onAll}>
          {reviews?.length ? 'Ver todas' : 'Calificar'}
        </button>
      </div>
      {reviews === null ? (
        <p className="lg-muted">Cargando…</p>
      ) : reviews.length === 0 ? (
        <p className="lg-muted">Todavía nadie ha calificado este lugar. ¿Ya fuiste? Cuéntanos cómo te fue.</p>
      ) : (
        <ul className="lg-review-list">
          {reviews.slice(0, 2).map((r) => (
            <li key={r.id}>
              <ReviewItem review={r} hotelName={venue.name} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

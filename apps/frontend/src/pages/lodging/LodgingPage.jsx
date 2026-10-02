import { BedDouble, CalendarCheck, ChevronLeft, ChevronRight, Eye, Heart, List, Map as MapIcon, MapPin, MessageCircle, Settings, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import fondoBuscador from '../../assets/fondo-buscador.png';
import Lightbox from '../../components/common/Lightbox.jsx';
import PageShell from '../../components/layout/PageShell.jsx';
import { lodgingApi } from '../../features/lodging/api.js';
import { amenitiesOf, contactLink, kindOf, useHotelFavorites } from '../../features/lodging/model.js';
import { formatCop } from '../../lib/money.js';
import { useNavigate } from '../../lib/router.jsx';
import { useMediaQuery } from '../../lib/useMediaQuery.js';
import HotelsMap from './HotelsMap.jsx';
import ReservationDialog from './ReservationDialog.jsx';
import { RatingLine, Stars } from './Stars.jsx';
import './lodging.css';

const DESKTOP = '(min-width: 1180px)';
const normalize = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const hotelPath = (id) => `/hospedaje/hotel?id=${id}`;

/**
 * Hospedaje: los hoteles, fincas y hostales de Neira para turistas. Arriba los recomendados (los elige el
 * administrador, con su banner); abajo la lista o el mapa (el mismo del inicio, solo con hoteles). En computador, a la
 * derecha, el mapa y la ficha del hotel elegido con sus opiniones.
 */
export default function LodgingPage({ user, onLogout }) {
  const navigate = useNavigate();
  const desktop = useMediaQuery(DESKTOP);
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [mode, setMode] = useState(() => (new URLSearchParams(window.location.search).get('vista') === 'mapa' ? 'map' : 'list'));
  const [selectedId, setSelectedId] = useState(null);
  const [focusKey, setFocusKey] = useState(0);
  const [booking, setBooking] = useState(null);
  const favorites = useHotelFavorites();
  const isHotel = user.roles?.includes('hotel');

  const load = useCallback(async () => {
    try {
      setState({ list: await lodgingApi.list(), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const kinds = useMemo(() => [...new Set(state.list.map((h) => h.kind))], [state.list]);
  const shown = useMemo(() => {
    const q = normalize(query.trim());
    return state.list.filter((h) => (kind === 'all' || h.kind === kind) && (!q || normalize(`${h.name} ${h.tagline} ${h.address} ${h.description}`).includes(q)));
  }, [state.list, query, kind]);
  const recommended = state.list.filter((h) => h.is_recommended);
  const selected = shown.find((h) => h.id === selectedId) ?? null;

  // En computador siempre hay un hotel abierto a la derecha: el primero de la lista si no se ha elegido otro.
  useEffect(() => {
    if (desktop && shown.length && !shown.some((h) => h.id === selectedId)) setSelectedId(shown[0].id);
  }, [desktop, shown, selectedId]);

  const showOnMap = (id) => {
    setSelectedId(id);
    setMode('map');
    setFocusKey((k) => k + 1);
  };

  const listBody = state.loading ? (
    <p className="lg-empty">Cargando hoteles…</p>
  ) : state.error ? (
    <div className="lg-empty">
      <p role="alert">{state.error}</p>
      <button type="button" className="lg-btn outline" onClick={load}>
        Reintentar
      </button>
    </div>
  ) : shown.length === 0 ? (
    <div className="lg-empty">
      <BedDouble size={40} aria-hidden="true" />
      <p>{state.list.length ? 'No hay hoteles que coincidan con tu búsqueda.' : 'Muy pronto verás aquí los hoteles de Neira.'}</p>
    </div>
  ) : null;

  const detail = selected && (
    <>
      <HotelCard
        hotel={selected}
        favorite={favorites.has(selected.id)}
        onFavorite={() => favorites.toggle(selected.id)}
        onMap={() => showOnMap(selected.id)}
        onBook={() => setBooking(selected)}
        onOpen={() => navigate(hotelPath(selected.id))}
      />
      <ReviewsPreview hotel={selected} onAll={() => navigate(`${hotelPath(selected.id)}#opiniones`)} />
    </>
  );

  return (
    <PageShell user={user} onLogout={onLogout} query={query} onQuery={setQuery} flush heroImage={fondoBuscador} centerLogo className="lg-view">
      <div className="lg-page">
        <div className={`lg-layout ${mode}`}>
          <div className="lg-main">
            {recommended.length > 0 && <Recommended hotels={recommended} onOpen={(h) => navigate(hotelPath(h.id))} />}

            <header className="lg-head">
              <div>
                <h1>Hoteles en Neira</h1>
                <p>Descubre los mejores lugares para hospedarte</p>
              </div>
              <div className="lg-head-actions">
                <button type="button" className="lg-link" onClick={() => navigate('/hospedaje/mis-reservas')}>
                  <CalendarCheck size={17} aria-hidden="true" /> Mis reservas
                </button>
                {isHotel && (
                  <button type="button" className="lg-link" onClick={() => navigate('/hotel')}>
                    <Settings size={17} aria-hidden="true" /> Mi hotel
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

            {kinds.length > 1 && (
              <div className="lg-kinds" role="toolbar" aria-label="Tipo de hospedaje">
                <button type="button" className={kind === 'all' ? 'on' : ''} aria-pressed={kind === 'all'} onClick={() => setKind('all')}>
                  Todos
                </button>
                {kinds.map((k) => {
                  const { label, Icon } = kindOf(k);
                  return (
                    <button key={k} type="button" className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>
                      <Icon size={16} aria-hidden="true" /> {label}
                    </button>
                  );
                })}
              </div>
            )}

            {listBody ??
              (mode === 'list' ? (
                <ul className="lg-list">
                  {shown.map((h) => (
                    <li key={h.id}>
                      <HotelRow
                        hotel={h}
                        active={desktop && h.id === selected?.id}
                        onSelect={() => (desktop ? setSelectedId(h.id) : navigate(hotelPath(h.id)))}
                        onOpen={() => navigate(hotelPath(h.id))}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <HotelsMap hotels={shown} selectedId={selected?.id} onSelect={setSelectedId} onList={() => setMode('list')} focusKey={focusKey} className="big" />
                  {!desktop && (selected ? <div className="lg-map-detail">{detail}</div> : <p className="lg-map-hint">Toca un hotel en el mapa para ver su información.</p>)}
                </>
              ))}
          </div>

          {desktop && (
            <aside className="lg-side" aria-label="Hotel elegido">
              {mode === 'list' && shown.length > 0 && <HotelsMap hotels={shown} selectedId={selected?.id} onSelect={setSelectedId} onList={null} focusKey={focusKey} />}
              {detail}
            </aside>
          )}
        </div>
      </div>
      {booking && <ReservationDialog user={user} hotel={booking} onClose={() => setBooking(null)} onDone={() => navigate('/hospedaje/mis-reservas')} />}
    </PageShell>
  );
}

/** "Hoteles recomendados": banner por hotel con su fondo, pasa solo cada 7 segundos. */
function Recommended({ hotels, onOpen }) {
  const [index, setIndex] = useState(0);
  const count = hotels.length;
  const current = hotels[index % count];
  useEffect(() => {
    if (count < 2) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 7000);
    return () => clearInterval(timer);
  }, [count, index]);
  const background = current.banner_url || current.photos[0];

  return (
    <section className="lg-reco" aria-labelledby="lg-reco-title" aria-roledescription="carrusel">
      <h2 id="lg-reco-title" className="lg-section-title">
        Hoteles recomendados
      </h2>
      <article className="lg-reco-card" aria-roledescription="diapositiva" aria-label={`${(index % count) + 1} de ${count}`}>
        {background && <img key={background} src={background} alt="" className="lg-reco-bg" />}
        <span className="lg-badge">
          <Star size={13} fill="currentColor" aria-hidden="true" /> Recomendado
        </span>
        <div className="lg-reco-text">
          <h3>{current.name}</h3>
          {current.tagline && <p>{current.tagline}</p>}
          <RatingLine hotel={current} size={17} />
          <button type="button" className="lg-btn primary" onClick={() => onOpen(current)}>
            Ver hotel
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
              {hotels.map((h, n) => (
                <button key={h.id} type="button" className={n === index % count ? 'on' : ''} aria-label={`Ver ${h.name}`} onClick={() => setIndex(n)} />
              ))}
            </div>
          </>
        )}
      </article>
    </section>
  );
}

export function AmenityIcons({ ids, max = 5, labels = true }) {
  const list = amenitiesOf(ids);
  const extra = list.length - max;
  return (
    <ul className={`lg-amenities${labels ? '' : ' compact'}`}>
      {list.slice(0, max).map(({ id, label, Icon }) => (
        <li key={id} title={label}>
          <Icon size={labels ? 20 : 17} aria-hidden="true" />
          {labels ? <span>{label}</span> : <span className="lg-sr">{label}</span>}
        </li>
      ))}
      {extra > 0 && (
        <li className="more" title={list.slice(max).map((a) => a.label).join(', ')}>
          +{extra}
        </li>
      )}
    </ul>
  );
}

function HotelRow({ hotel: h, active, onSelect, onOpen }) {
  return (
    <article className={`lg-row${active ? ' active' : ''}`}>
      <button type="button" className="lg-row-photo" onClick={onSelect} aria-label={`Ver ${h.name}`}>
        {h.photos[0] && <img src={h.photos[0]} alt="" loading="lazy" />}
        {h.is_recommended && <span className="lg-badge small">Recomendado</span>}
      </button>
      <div className="lg-row-info">
        <h3>
          <button type="button" onClick={onSelect}>
            {h.name}
          </button>
        </h3>
        <p className="lg-address">
          <MapPin size={15} aria-hidden="true" /> {h.address}
        </p>
        <RatingLine hotel={h} size={14} />
        <AmenityIcons ids={h.amenities} max={5} />
      </div>
      <div className="lg-row-side">
        <p className="lg-price">
          <small>Desde</small>
          <strong>{formatCop(h.price_from_cop)}</strong>
          <small>por noche</small>
        </p>
        <button type="button" className="lg-btn primary" onClick={onOpen}>
          <Eye size={16} aria-hidden="true" /> Ver detalles
        </button>
        <a className="lg-btn outline" href={contactLink(h)} target="_blank" rel="noreferrer">
          <MessageCircle size={16} aria-hidden="true" /> Contactar
        </a>
      </div>
    </article>
  );
}

/** La ficha del hotel elegido (a la derecha en computador, debajo del mapa en celular). */
export function HotelCard({ hotel: h, favorite, onFavorite, onMap, onBook, onOpen }) {
  const [viewer, setViewer] = useState(null);
  const thumbs = h.photos.slice(1, 5);
  const extra = h.photos.length - 5;
  return (
    <article className="lg-card">
      <div className="lg-card-photo">
        <button type="button" className="lg-card-main" onClick={() => setViewer(0)} aria-label="Ver fotos en grande">
          {h.photos[0] && <img src={h.photos[0]} alt={`Foto de ${h.name}`} />}
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
        <h2>
          <button type="button" onClick={onOpen}>
            {h.name}
          </button>
        </h2>
        <RatingLine hotel={h} />
        <p className="lg-address">
          <MapPin size={15} aria-hidden="true" /> {h.address}
        </p>
        <p className="lg-card-desc">{h.description}</p>
        <AmenityIcons ids={h.amenities} max={6} />
        <p className="lg-price inline">
          <small>Desde</small> <strong>{formatCop(h.price_from_cop)}</strong> <small>por noche</small>
        </p>
        <div className="lg-card-actions">
          <button type="button" className="lg-btn outline" onClick={onMap}>
            <MapPin size={16} aria-hidden="true" /> Ver en el mapa
          </button>
          <a className="lg-btn outline" href={contactLink(h)} target="_blank" rel="noreferrer">
            <MessageCircle size={16} aria-hidden="true" /> Contactar
          </a>
          <button type="button" className="lg-btn primary" onClick={onBook}>
            <CalendarCheck size={16} aria-hidden="true" /> Hacer reserva
          </button>
        </div>
      </div>
      {viewer !== null && (
        <Lightbox images={h.photos.map((url, n) => ({ id: n, url, caption: h.name }))} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />
      )}
    </article>
  );
}

/** Las dos opiniones más recientes, con la respuesta del hotel. */
function ReviewsPreview({ hotel, onAll }) {
  const [reviews, setReviews] = useState(null);
  useEffect(() => {
    let alive = true;
    setReviews(null);
    lodgingApi
      .reviews(hotel.id)
      .then((list) => alive && setReviews(list))
      .catch(() => alive && setReviews([]));
    return () => {
      alive = false;
    };
  }, [hotel.id]);

  return (
    <section className="lg-opinions" aria-labelledby="lg-op-title">
      <div className="lg-opinions-head">
        <h2 id="lg-op-title">Opiniones de los huéspedes</h2>
        <button type="button" className="lg-link" onClick={onAll}>
          {reviews?.length ? 'Ver todas' : 'Calificar'}
        </button>
      </div>
      {reviews === null ? (
        <p className="lg-muted">Cargando…</p>
      ) : reviews.length === 0 ? (
        <p className="lg-muted">Todavía nadie ha calificado este hotel. ¿Te hospedaste aquí? Cuéntanos cómo te fue.</p>
      ) : (
        <ul className="lg-review-list">
          {reviews.slice(0, 2).map((r) => (
            <li key={r.id}>
              <ReviewItem review={r} hotelName={hotel.name} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const reviewDate = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const initialsOf = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

export function ReviewItem({ review: r, hotelName, mine = false }) {
  return (
    <article className="lg-review">
      <div className="lg-review-head">
        <span className="lg-avatar" aria-hidden="true">
          {initialsOf(r.author_name)}
        </span>
        <div>
          <strong>
            {r.author_name}
            {mine && <span className="lg-mine">Tu reseña</span>}
          </strong>
          <span className="lg-review-meta">
            <Stars value={r.stars} size={13} /> {reviewDate(r.created_at)}
          </span>
        </div>
      </div>
      {r.comment && <p>{r.comment}</p>}
      {r.reply && (
        <div className="lg-reply">
          <strong>Respuesta de {hotelName}</strong>
          <p>{r.reply}</p>
        </div>
      )}
    </article>
  );
}

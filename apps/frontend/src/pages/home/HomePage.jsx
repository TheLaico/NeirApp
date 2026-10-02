import {
  ArrowRight,
  Bike,
  Briefcase,
  CalendarCheck,
  Car,
  Crown,
  ChevronRight,
  Heart,
  Home as HomeIcon,
  Mic,
  Package,
  Search,
  Star,
  Store,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import { Leaf } from '../../components/common/Leaf.jsx';
import cardVerMapa from '../../assets/card-ver-mapa.png';
import fondoBuscador from '../../assets/fondo-buscador.png';
import { useProfessionalDirectory } from '../../features/professionals/directory.js';
import { useStores } from '../../features/stores/api.js';
import { useNavigate } from '../../lib/router.jsx';
import './home-feed.css';

const normalize = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Categorías del encabezado. "Domicilios" lleva al mapa (las tiendas reales); las demás todavía no son
// módulos propios en NeirAPP, así que —igual que "Otros servicios" más abajo— abren un aviso de
// "próximamente" en vez de fingir que filtran algo.
const TOP_CATS = [
  { id: 'domicilios', label: 'Domicilios', color: '#0f5238', Icon: Bike },
  { id: 'profesionales', label: 'Profesionales', color: '#E8A92C', Icon: Briefcase },
  { id: 'transporte', label: 'Transporte', color: '#1D8A9C', Icon: Car },
  { id: 'hospedaje', label: 'Hospedaje', color: '#B6533C', Icon: HomeIcon },
  { id: 'marquetneira', label: 'MarketNeira', color: '#6A4C93', Icon: Store },
  { id: 'proveedores', label: 'Proveedores', color: '#3B6E8F', Icon: Package },
  { id: 'reservas', label: 'Reservas', color: '#C0587A', Icon: CalendarCheck },
];

// Cuántas veces se repite la fila de categorías dentro de la pasarela: de sobra para que, en cualquier
// ancho de pantalla, siempre quede contenido de más a los dos lados y el salto al reiniciar no se note.
const CAT_LOOPS = 6;

/** Fila de categorías que se desliza sola hacia la izquierda y también se puede arrastrar con el mouse (o el dedo). */
function CatCarousel({ cats, onSelect }) {
  const trackRef = useRef(null);
  const unitRef = useRef(0);
  const drag = useRef({ active: false, moved: false, startX: 0, startScroll: 0 });
  const hovered = useRef(false);

  const wrap = () => {
    const track = trackRef.current;
    const unit = unitRef.current;
    if (!track || !unit) return;
    // El listado está repetido `CAT_LOOPS` veces: al acercarnos a cualquiera de las puntas saltamos
    // exactamente un "unit" (el ancho de una vuelta completa), que es invisible porque el patrón se repite.
    if (track.scrollLeft < unit) track.scrollLeft += unit;
    else if (track.scrollLeft > unit * (CAT_LOOPS - 1)) track.scrollLeft -= unit;
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    unitRef.current = track.scrollWidth / CAT_LOOPS;
    track.scrollLeft = unitRef.current * Math.floor(CAT_LOOPS / 2);

    let raf;
    const tick = () => {
      // Se detiene con el mouse encima (no solo al arrastrar): si la fila se sigue moviendo bajo el
      // cursor, el clic puede caer sobre la categoría vecina en vez de la que se veía al apuntar.
      if (!drag.current.active && !hovered.current) {
        track.scrollLeft += 0.5;
        wrap();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onPointerDown = (e) => {
    const track = trackRef.current;
    drag.current = { active: true, moved: false, startX: e.clientX, startScroll: track.scrollLeft, pointerId: e.pointerId };
    track.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    trackRef.current.scrollLeft = drag.current.startScroll - dx;
    wrap();
  };
  const endDrag = () => {
    drag.current.active = false;
    const track = trackRef.current;
    if (track?.hasPointerCapture(drag.current.pointerId)) track.releasePointerCapture(drag.current.pointerId);
  };
  // El clic se resuelve por coordenadas, no por a qué elemento "diga" el navegador que apuntó: con la fila
  // moviéndose (y la captura del arrastre de por medio) a veces el clic llega marcado como si hubiera caído
  // en el contenedor entero en vez de en el botón que de verdad está debajo del cursor en ese momento.
  const onClick = (e) => {
    if (drag.current.moved) return;
    const btn = e.target.closest('button[data-cat-id]') ?? document.elementFromPoint(e.clientX, e.clientY)?.closest('button[data-cat-id]');
    if (btn) onSelect(btn.dataset.catId);
  };

  const items = [];
  for (let loop = 0; loop < CAT_LOOPS; loop += 1) {
    cats.forEach((cat) => items.push({ ...cat, loop }));
  }

  return (
    <div
      className="feed-cat-track"
      ref={trackRef}
      role="group"
      aria-label="Categorías"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={onClick}
      onMouseEnter={() => { hovered.current = true; }}
      onMouseLeave={() => { hovered.current = false; }}
    >
      {items.map(({ id, label, color, Icon, loop }) => (
        <button
          key={`${loop}-${id}`}
          type="button"
          className="feed-cat"
          data-cat-id={id}
          tabIndex={loop === 0 ? 0 : -1}
          aria-hidden={loop === 0 ? undefined : true}
        >
          <span className="feed-cat-dot" style={{ background: color }}>
            <Icon size={22} color="#fff" aria-hidden="true" />
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}

// Filas de "Otros servicios": todavía no existen como módulo propio (no son categorías reales de tienda),
// así que se muestran marcadas como "Próximamente" en vez de fingir que funcionan.
const MORE_SERVICES = [
  { label: 'Servicios profesionales', text: 'Encuentra expertos locales.', Icon: Briefcase, color: '#E8A92C' },
  { label: 'Transporte', text: 'Muévete por Neira de forma fácil.', Icon: Car, color: '#1D8A9C' },
  { label: 'Hospedaje', text: 'Alojamientos cómodos en Neira.', Icon: HomeIcon, color: '#B6533C' },
];

/** Todas las categorías, quietas y en cuadrícula, para verlas con calma sin que se deslicen. */
function MoreCategoriesModal({ cats, onSelect, onClose }) {
  return (
    <div className="cats-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cats-modal" role="dialog" aria-modal="true" aria-labelledby="cats-title">
        <button type="button" className="cats-close" onClick={onClose} aria-label="Cerrar">
          <X size={20} aria-hidden="true" />
        </button>
        <h2 id="cats-title">Categorías</h2>
        <div className="cats-grid">
          {cats.map(({ id, label, color, Icon }) => (
            <button key={id} type="button" className="cats-grid-item" onClick={() => onSelect(id)}>
              <span className="feed-cat-dot" style={{ background: color }}>
                <Icon size={22} color="#fff" aria-hidden="true" />
              </span>
              <span>{label}</span>
              {id !== 'domicilios' && id !== 'profesionales' && id !== 'marquetneira' && id !== 'proveedores' && <span className="feed-soon">Próximamente</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Recomendados en el inicio: los profesionales con plan Premium (es uno de los beneficios del plan). */
function RecommendedProfessionals({ onOpen, onSeeAll }) {
  const { list } = useProfessionalDirectory();
  const premium = list.filter((p) => p.plan === 'premium').slice(0, 6);
  if (premium.length === 0) return null;
  return (
    <section className="feed-section" aria-labelledby="feed-pros">
      <header className="feed-section-head">
        <h2 id="feed-pros">Profesionales recomendados</h2>
        <button type="button" className="feed-see-all" onClick={onSeeAll}>
          Ver todos <ChevronRight size={16} aria-hidden="true" />
        </button>
      </header>
      <ul className="feed-pros">
        {premium.map((p) => (
          <li key={p.id}>
            <button type="button" className="feed-pro" onClick={() => onOpen(p)}>
              <span className="feed-pro-photo">{p.photo ? <img src={p.photo} alt="" loading="lazy" /> : <span aria-hidden="true">{p.name.replace(/^(Dr|Dra|Ing|Abg|Arq|Lic|Psic|Cont)\. /, '').charAt(0)}</span>}</span>
              <span className="feed-pro-info">
                <strong>{p.name}</strong>
                <span>{p.headline || 'Profesional en Neira'}</span>
              </span>
              <span className="feed-pro-badge">
                <Crown size={12} aria-hidden="true" /> Premium
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BrandCard({ store, onOpen }) {
  const { Icon } = store;
  return (
    <button type="button" className="feed-brand" onClick={() => onOpen(store)}>
      <span className="feed-brand-ico" style={{ background: store.color }}>
        <Icon size={26} color="#fff" aria-hidden="true" />
      </span>
      <span className="feed-brand-info">
        <strong>{store.name}</strong>
        {store.rating ? (
          <span className="feed-brand-rating">
            <Star size={13} fill="#F2A81D" color="#F2A81D" aria-hidden="true" />
            {store.rating.toFixed(1)}
          </span>
        ) : (
          <span className="feed-brand-rating muted">Nueva</span>
        )}
      </span>
    </button>
  );
}

/**
 * Página de inicio: un resumen tipo "todo en un solo lugar" (buscador, categorías, acceso al mapa y
 * las tiendas de Neira), en vez del mapa de una vez. El mapa completo ahora vive en "/mapa".
 */
// ¿El navegador sabe transcribir voz? (Chrome/Edge sí; Firefox y Safari todavía no lo traen).
const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export default function HomePage({ user, onLogout }) {
  const { stores, status } = useStores();
  const [query, setQuery] = useState('');
  const [showMoreCats, setShowMoreCats] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const resultsRef = useRef(null);
  const navigate = useNavigate();

  const filtering = Boolean(query.trim());
  const brands = useMemo(() => {
    const q = normalize(query.trim());
    const matches = stores.filter((s) => !q || normalize(`${s.name} ${s.label}`).includes(q));
    // Sin búsqueda activa, solo se destacan unas pocas; con búsqueda, se ven todos los resultados.
    return filtering ? matches : matches.slice(0, 6);
  }, [stores, query, filtering]);

  // Al escribir, los resultados caen más abajo (después del mapa y "Apoya lo nuestro"); sin este scroll
  // parecía que el buscador no hacía nada porque el cambio quedaba fuera de la vista.
  useEffect(() => {
    if (filtering) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [filtering]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const toggleVoiceSearch = () => {
    if (!SpeechRecognition) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CO';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => setQuery(e.results[0][0].transcript);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const openStore = (store) => navigate(`/mapa?tienda=${store.id}`);
  // "Domicilios" y "Profesionales" ya tienen a dónde ir; las demás categorías, todavía no.
  const openCategory = (id) => {
    if (id === 'domicilios') {
      navigate('/mapa');
      setShowMoreCats(false);
    } else if (id === 'profesionales') {
      navigate('/profesionales');
      setShowMoreCats(false);
    } else if (id === 'marquetneira') {
      navigate('/marquetneira');
      setShowMoreCats(false);
    } else if (id === 'proveedores') {
      navigate('/proveedores');
      setShowMoreCats(false);
    }
  };

  return (
    <PageShell user={user} onLogout={onLogout} flush heroImage={fondoBuscador} centerLogo>
      <div className="home-feed">
        <section className="feed-hero">
          <label className="feed-search">
            <Search size={20} aria-hidden="true" />
            <input
              type="search"
              placeholder="¿Qué estás buscando?"
              aria-label="Buscar tiendas"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className={`feed-mic${listening ? ' listening' : ''}`}
              aria-label="Buscar por voz"
              aria-pressed={listening}
              title={SpeechRecognition ? (listening ? 'Escuchando…' : 'Buscar por voz') : 'Tu navegador no admite búsqueda por voz'}
              disabled={!SpeechRecognition}
              onClick={toggleVoiceSearch}
            >
              <Mic size={20} aria-hidden="true" />
            </button>
          </label>

          <div className="feed-cats-wrap">
            <CatCarousel
              cats={TOP_CATS}
              onSelect={(id) => (id === 'domicilios' || id === 'profesionales' || id === 'marquetneira' || id === 'proveedores' ? openCategory(id) : setShowMoreCats(true))}
            />
            <button type="button" className="feed-cat feed-cat-static" onClick={() => setShowMoreCats(true)}>
              <span className="feed-cat-dot feed-cat-more">
                <ArrowRight size={22} color="#fff" aria-hidden="true" />
              </span>
              Más
            </button>
          </div>
        </section>

        {showMoreCats && <MoreCategoriesModal cats={TOP_CATS} onSelect={openCategory} onClose={() => setShowMoreCats(false)} />}

        <button type="button" className="feed-card feed-map-card" onClick={() => navigate('/mapa')}>
          <img src={cardVerMapa} alt="Explora las tiendas en Neira: toca un marcador para ver su catálogo y hacer tu pedido." />
          <span className="feed-map-btn">
            Ver mapa <ArrowRight size={18} aria-hidden="true" />
          </span>
        </button>

        <section className="feed-support">
          <Leaf fill="#e8a92c" style={{ left: -14, top: -18, width: 60, transform: 'rotate(-30deg)' }} />
          <Leaf fill="#2d7a3d" style={{ right: -10, bottom: -20, width: 58, transform: 'rotate(150deg)' }} />
          <div>
            <strong>
              Apoya lo nuestro <Heart size={20} fill="#fff" aria-hidden="true" />
            </strong>
            <p>Productos locales, siempre más cerca de ti.</p>
          </div>
        </section>

        <section className="feed-section" ref={resultsRef}>
          <header className="feed-section-head">
            <h2>Pide a domicilio de estas marcas</h2>
            {!filtering && stores.length > 6 && (
              <button type="button" className="feed-see-all" onClick={() => navigate('/mapa')}>
                Ver todas <ChevronRight size={16} aria-hidden="true" />
              </button>
            )}
          </header>

          {status === 'loading' && <p className="feed-empty">Cargando tiendas…</p>}
          {status === 'error' && (
            <p className="feed-empty" role="alert">
              No se pudieron cargar las tiendas. Intenta de nuevo más tarde.
            </p>
          )}
          {status === 'ok' && brands.length === 0 && (
            <p className="feed-empty">{filtering ? 'No hay tiendas que coincidan con tu búsqueda.' : 'Todavía no hay tiendas en Neira.'}</p>
          )}

          <div className="feed-brand-grid">
            {brands.map((s) => (
              <BrandCard key={s.id} store={s} onOpen={openStore} />
            ))}
          </div>
        </section>

        <RecommendedProfessionals onOpen={(p) => navigate(`/profesionales/perfil?id=${p.id}`)} onSeeAll={() => navigate('/profesionales')} />

        <section className="feed-section">
          <h2>Otros servicios</h2>
          <ul className="feed-more-list">
            {MORE_SERVICES.map(({ label, text, Icon, color }) => (
              <li key={label} className="feed-more-item" style={{ '--tint': color }}>
                <span className="feed-more-ico">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <span className="feed-more-text">
                  <strong>{label}</strong>
                  <span>{text}</span>
                </span>
                <span className="feed-soon">Próximamente</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}

import {
  ArrowRight,
  Briefcase,
  CalendarCheck,
  Car,
  Crown,
  ChevronRight,
  Heart,
  Home as HomeIcon,
  Package,
  Star,
  Store,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import HeroSearch from '../../components/common/HeroSearch.jsx';
import { Leaf } from '../../components/common/Leaf.jsx';
import cardVerMapa from '../../assets/card-ver-mapa.png';
import fondoBuscador from '../../assets/fondo-buscador.png';
import { useProfessionalDirectory } from '../../features/professionals/directory.js';
import { usePromotedProducts, useStores } from '../../features/stores/api.js';
import { CATEGORY_LABEL } from '../../features/stores/categories.jsx';
import { formatCop } from '../../lib/money.js';
import { useNavigate } from '../../lib/router.jsx';
import { TOP_CATS, categoryPath } from './categories.jsx';
import './home-feed.css';

const normalize = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Filas de "Otros servicios": los demás módulos de NeirAPP (los domicilios ya están arriba). `to`: su ruta.
const MORE_SERVICES = [
  { label: 'Servicios profesionales', text: 'Encuentra expertos locales.', Icon: Briefcase, color: '#E8A92C', to: '/profesionales' },
  { label: 'Transporte', text: 'Muévete por Neira de forma fácil.', Icon: Car, color: '#1D8A9C', to: '/transporte' },
  { label: 'Hospedaje', text: 'Alojamientos cómodos en Neira.', Icon: HomeIcon, color: '#B6533C', to: '/hospedaje' },
  { label: 'MarketNeira', text: 'Compra o alquila inmuebles en Neira.', Icon: Store, color: '#6A4C93', to: '/marquetneira' },
  { label: 'Proveedores', text: 'Productos locales al por mayor.', Icon: Package, color: '#3B6E8F', to: '/proveedores' },
  { label: 'Reservas', text: 'Reserva tu mesa, cancha o salón.', Icon: CalendarCheck, color: '#C0587A', to: '/reservas' },
];

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

/**
 * "Productos recomendados": los que los comerciantes pagaron por destacar ($ 7.000, ver "Destacar productos" en su
 * panel). Se filtran por la categoría de la tienda y, al tocarlos, se abre el producto en el mapa listo para el carrito.
 */
function RecommendedProducts({ onOpen }) {
  const { items } = usePromotedProducts();
  const [category, setCategory] = useState('all');
  const categories = [...new Set(items.map((i) => i.store.category))].filter((c) => CATEGORY_LABEL[c]);
  if (items.length === 0) return null;
  const shown = category === 'all' ? items : items.filter((i) => i.store.category === category);
  return (
    <section className="feed-section" aria-labelledby="feed-products">
      <header className="feed-section-head">
        <h2 id="feed-products">Productos recomendados</h2>
      </header>
      {categories.length > 1 && (
        <div className="feed-chips" role="group" aria-label="Filtrar por categoría">
          {['all', ...categories].map((c) => (
            <button key={c} type="button" className={category === c ? 'on' : ''} aria-pressed={category === c} onClick={() => setCategory(c)}>
              {c === 'all' ? 'Todos' : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      )}
      <ul className="feed-products">
        {shown.map(({ product, store }) => {
          const { Icon } = store;
          return (
            <li key={product.id}>
              <button type="button" className="feed-product" onClick={() => onOpen({ product, store })}>
                <span className="feed-product-img" style={product.image_url ? undefined : { background: store.color }}>
                  {product.image_url ? <img src={product.image_url} alt="" loading="lazy" /> : <Icon size={30} color="#fff" aria-hidden="true" />}
                </span>
                <span className="feed-product-info">
                  <strong>{product.name}</strong>
                  <span className="feed-product-price">{formatCop(product.price_cop)}</span>
                  <span className="feed-product-store">{store.name}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BrandCard({ store, onOpen }) {
  const { Icon } = store;
  return (
    // Card cuadrada que llena el logo de la marca, con el nombre debajo por si el logo no se entiende.
    // Sin logo, el ícono y el color de su categoría.
    <button type="button" className="feed-brand" onClick={() => onOpen(store)}>
      <span className="feed-brand-box" style={store.logo_url ? undefined : { background: store.color }}>
        {store.logo_url ? (
          <img className="feed-brand-logo" src={store.logo_url} alt="" loading="lazy" />
        ) : (
          <Icon size={34} color="#fff" aria-hidden="true" />
        )}
        {store.recommended_position != null && (
          <span className="feed-brand-rec">
            <Crown size={11} aria-hidden="true" /> Recomendado
          </span>
        )}
        {store.rating ? (
          <span className="feed-brand-rating">
            <Star size={12} fill="#F2A81D" color="#F2A81D" aria-hidden="true" />
            {store.rating.toFixed(1)}
          </span>
        ) : (
          <span className="feed-brand-rating muted">Nueva</span>
        )}
      </span>
      <span className="feed-brand-name">{store.name}</span>
    </button>
  );
}

/**
 * Página de inicio: un resumen tipo "todo en un solo lugar" (buscador, categorías, acceso al mapa y
 * las tiendas de Neira), en vez del mapa de una vez. El mapa completo ahora vive en "/mapa".
 */

export default function HomePage({ user, onLogout }) {
  const { stores, status } = useStores();
  const [query, setQuery] = useState('');
  const resultsRef = useRef(null);
  const navigate = useNavigate();

  const filtering = Boolean(query.trim());
  const brands = useMemo(() => {
    const q = normalize(query.trim());
    const matches = stores.filter((s) => !q || normalize(`${s.name} ${s.label}`).includes(q));
    // Las recomendadas por el administrador van primero, en su orden; después, las demás.
    const rank = (s) => s.recommended_position ?? Infinity;
    matches.sort((a, b) => rank(a) - rank(b));
    // Sin búsqueda activa, solo se destacan unas pocas; con búsqueda, se ven todos los resultados.
    return filtering ? matches : matches.slice(0, 6);
  }, [stores, query, filtering]);

  // Al escribir, los resultados caen más abajo (después del mapa y "Apoya lo nuestro"); sin este scroll
  // parecía que el buscador no hacía nada porque el cambio quedaba fuera de la vista.
  useEffect(() => {
    if (filtering) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [filtering]);

  const openStore = (store) => navigate(`/mapa?tienda=${store.id}`);
  const openCategory = (id) => {
    const to = categoryPath(id);
    if (to) navigate(to);
  };

  return (
    <PageShell user={user} onLogout={onLogout} flush heroImage={fondoBuscador} centerLogo>
      <div className="home-feed">
        <HeroSearch value={query} onChange={setQuery} ariaLabel="Buscar tiendas" cats={TOP_CATS} onSelectCat={openCategory} />

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

        {!filtering && <RecommendedProducts onOpen={({ product, store }) => navigate(`/mapa?tienda=${store.id}&producto=${product.id}`)} />}

        <RecommendedProfessionals onOpen={(p) => navigate(`/profesionales/perfil?id=${p.id}`)} onSeeAll={() => navigate('/profesionales')} />

        <section className="feed-section">
          <h2>Otros servicios</h2>
          <ul className="feed-more-list">
            {MORE_SERVICES.map(({ label, text, Icon, color, to }) => (
              <li key={label}>
                <button type="button" className="feed-more-item" style={{ '--tint': color }} onClick={() => navigate(to)}>
                  <span className="feed-more-ico">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <span className="feed-more-text">
                    <strong>{label}</strong>
                    <span>{text}</span>
                  </span>
                  <ChevronRight size={20} className="feed-more-chev" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}

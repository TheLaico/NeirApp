import { CalendarDays, ChevronDown, Heart, LayoutGrid, Package, Plus, Sofa, Store, Tag } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import banner from '../../assets/marketplace/fondo-marquetplace.webp';
import fondoBuscador from '../../assets/fondo-buscador.png';
import { Leaf } from '../../components/common/Leaf.jsx';
import PageShell from '../../components/layout/PageShell.jsx';
import { marketplaceApi } from '../../features/marketplace/api.js';
import { AVAILABILITY, CATEGORIES, PRICE_RANGES, useMarketFavorites } from '../../features/marketplace/model.js';
import { useNavigate } from '../../lib/router.jsx';
import ListingCard from './ListingCard.jsx';
import ReportDialog from './ReportDialog.jsx';
import './marketplace.css';

const normalize = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * MarquetNeira: inmuebles que la gente de Neira vende o alquila. NeirAPP solo media; el trato se cierra por WhatsApp.
 * Filtros: tipo (todos, venta, alquiler), precio, categoría y disponibilidad; el buscador de arriba busca por nombre.
 */
export default function MarketplacePage({ user, onLogout }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [price, setPrice] = useState('all');
  const [category, setCategory] = useState('all');
  const [availability, setAvailability] = useState('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [reporting, setReporting] = useState(null);
  const [toast, setToast] = useState('');
  const favorites = useMarketFavorites();

  const load = useCallback(async () => {
    try {
      setState({ list: await marketplaceApi.list(), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const shown = useMemo(() => {
    const q = normalize(query.trim());
    const range = PRICE_RANGES.find((r) => r.id === price) ?? PRICE_RANGES[0];
    const avail = AVAILABILITY.find((a) => a.id === availability) ?? AVAILABILITY[0];
    return state.list.filter(
      (i) =>
        (kind === 'all' || i.kind === kind) &&
        (category === 'all' || i.category === category) &&
        range.test(i) &&
        avail.test(i) &&
        (!onlyFavorites || favorites.has(i.id)) &&
        (!q || normalize(`${i.title} ${i.description}`).includes(q)),
    );
  }, [state.list, query, kind, price, category, availability, onlyFavorites, favorites]);

  const filtering = kind !== 'all' || price !== 'all' || category !== 'all' || availability !== 'all' || onlyFavorites || query.trim();
  const clear = () => {
    setKind('all');
    setPrice('all');
    setCategory('all');
    setAvailability('all');
    setOnlyFavorites(false);
    setQuery('');
  };

  return (
    <PageShell user={user} onLogout={onLogout} query={query} onQuery={setQuery} flush heroImage={fondoBuscador} centerLogo className="mq-view">
      <div className="mq-page">
        {/* Portada: el banner de MarquetNeira a todo el ancho, con la frase y los botones para publicar. */}
        <section className="mq-banner-card" aria-labelledby="mq-title">
          <h1 id="mq-title" className="mq-sr">
            Inmuebles en Neira
          </h1>
          <img className="mq-banner-img" src={banner} alt="MarquetNeira Inmobiliario" />
          <div className="mq-banner-foot">
            <div className="mq-banner-text">
              <p>Compra o alquila inmuebles de vendedores locales</p>
              <p className="mq-banner-desc">
                Encuentra casas, apartamentos, locales, fincas, lotes y más en Neira, publicados por sus propios dueños. Escríbeles directo por WhatsApp
                para preguntar, visitar y acordar el precio. NeirAPP solo los conecta: no cobramos comisión ni manejamos pagos entre ustedes. ¿Tienes
                un inmueble? Publícalo por $ 10.000 al mes.
              </p>
            </div>
            <div className="mq-hero-actions">
              <button type="button" className="mq-btn primary" onClick={() => navigate('/marquetneira/mis-publicaciones?nueva=1')}>
                <Plus size={17} aria-hidden="true" /> Publicar un inmueble
              </button>
              <button type="button" className="mq-btn outline" onClick={() => navigate('/marquetneira/mis-publicaciones')}>
                <Store size={17} aria-hidden="true" /> Mis publicaciones
              </button>
            </div>
          </div>
        </section>

        <div className="mq-filters" role="toolbar" aria-label="Filtrar inmuebles">
          <span className="mq-filters-leaf left" aria-hidden="true">
            <Leaf fill="#3f8f4f" style={{ left: 0, top: -8, width: 34, '--r': '-20deg' }} />
            <Leaf fill="#e8a92c" style={{ left: 22, top: 4, width: 24, '--r': '30deg' }} />
          </span>
          <div className="mq-kinds" role="radiogroup" aria-label="Tipo">
            {[
              { id: 'all', label: 'Todos', Icon: LayoutGrid },
              { id: 'sale', label: 'Venta', Icon: Tag },
              { id: 'rent', label: 'Alquiler', Icon: CalendarDays },
            ].map(({ id, label, Icon }) => (
              <button key={id} type="button" role="radio" aria-checked={kind === id} className={kind === id ? 'on' : ''} onClick={() => setKind(id)}>
                <Icon size={18} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
          <span className="mq-sep" aria-hidden="true" />
          <Dropdown label="Precio" Icon={Tag} value={price} options={PRICE_RANGES} onChange={setPrice} />
          <Dropdown label="Categoría" Icon={Sofa} value={category} options={[{ id: 'all', label: 'Todas las categorías' }, ...CATEGORIES]} onChange={setCategory} />
          <Dropdown label="Disponibilidad" Icon={Package} value={availability} options={AVAILABILITY} onChange={setAvailability} />
          <button type="button" className={`mq-fav-filter${onlyFavorites ? ' on' : ''}`} aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites((v) => !v)}>
            <Heart size={17} aria-hidden="true" fill={onlyFavorites ? 'currentColor' : 'none'} /> Favoritos
          </button>
          <span className="mq-filters-leaf right" aria-hidden="true">
            <Leaf fill="#2d7a3d" style={{ right: 0, top: -6, width: 34, '--r': '24deg' }} />
          </span>
        </div>

        {state.loading ? (
          <p className="mq-empty">Cargando inmuebles…</p>
        ) : state.error ? (
          <div className="mq-empty">
            <p role="alert">{state.error}</p>
            <button type="button" className="mq-btn outline" onClick={load}>
              Reintentar
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="mq-empty">
            <Sofa size={40} aria-hidden="true" />
            <p>{filtering ? 'No hay inmuebles que coincidan con estos filtros.' : 'Todavía no hay inmuebles publicados. ¡Sé el primero en ofrecer el tuyo!'}</p>
            {filtering ? (
              <button type="button" className="mq-btn outline" onClick={clear}>
                Quitar filtros
              </button>
            ) : (
              <button type="button" className="mq-btn primary" onClick={() => navigate('/marquetneira/mis-publicaciones?nueva=1')}>
                <Plus size={17} aria-hidden="true" /> Publicar un inmueble
              </button>
            )}
          </div>
        ) : (
          <ul className="mq-grid">
            {shown.map((item) => (
              <li key={item.id}>
                <ListingCard
                  item={item}
                  own={item.seller_id === user.id}
                  favorite={favorites.has(item.id)}
                  onFavorite={() => favorites.toggle(item.id)}
                  onOpen={() => navigate(`/marquetneira/producto?id=${item.id}`)}
                  onReport={() => setReporting(item)}
                  onCopied={setToast}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {reporting && <ReportDialog listing={reporting} onClose={() => setReporting(null)} />}
      {toast && (
        <p className="mq-toast" role="status">
          {toast}
        </p>
      )}
    </PageShell>
  );
}

/** Filtro desplegable (Precio, Categoría, Disponibilidad). Se marca cuando tiene algo elegido. */
function Dropdown({ label, Icon, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = value !== 'all';
  const current = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className="mq-drop" ref={ref}>
      <button type="button" className={`mq-drop-btn${active ? ' on' : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon size={18} aria-hidden="true" />
        <span>{active ? current?.label : label}</span>
        <ChevronDown size={16} aria-hidden="true" className="mq-drop-chev" />
      </button>
      {open && (
        <ul className="mq-drop-list" role="listbox" aria-label={label}>
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === value}
                className={o.id === value ? 'on' : ''}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
              >
                {o.Icon && <o.Icon size={16} aria-hidden="true" />}
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

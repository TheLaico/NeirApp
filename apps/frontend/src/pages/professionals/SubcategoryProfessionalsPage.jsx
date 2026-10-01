import { ArrowLeft, Check, ChevronDown, MessageCircle, Phone, Search, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import { CATEGORY_ICONS, CATEGORY_IMAGE_KEYS, DEFAULT_SUBCATEGORY_COLOR, useProfessionalCategories } from '../../features/professionals/categories.js';
import { telLink, useProfessionalDirectory, whatsappLink } from '../../features/professionals/directory.js';
import { useNavigate } from '../../lib/router.jsx';
import './subcategory-page.css';

// Todas las ilustraciones que ya existan en assets/professionals quedan disponibles por nombre de
// archivo (sin extensión); las que el admin todavía no subió simplemente no aparecen acá, así que el
// encabezado de esa categoría se ve sin imagen (ver CATEGORY_IMAGE_KEYS).
const CATEGORY_IMAGES = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/professionals/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' }),
  ).map(([path, url]) => [path.match(/([^/]+)\.[^./]+$/)[1], url]),
);

/**
 * Página de una subcategoría (ej. "Ingeniería Civil"): profesionales de esa especialidad que ya publicaron su perfil
 * desde su panel. El orden lo da la API: destacados primero, luego los disponibles.
 */
export default function SubcategoryProfessionalsPage({ user, onLogout }) {
  const { categories, loading: categoriesLoading } = useProfessionalCategories();
  const navigate = useNavigate();
  // La ruta es fija (/profesionales/categoria) y el destino real va en la query (?cat=&sub=), como el
  // `?tienda=` del mapa. El router de esta app solo reacciona a cambios de *pathname*, así que estos IDs
  // viven en estado propio (si no, cambiar de especialidad con el selector no volvería a renderizar).
  const [catId, setCatId] = useState(() => new URLSearchParams(window.location.search).get('cat'));
  const [subId, setSubId] = useState(() => new URLSearchParams(window.location.search).get('sub'));
  const category = categories.find((c) => c.id === catId);
  const sub = category?.subcategories.find((s) => s.id === subId);
  const directory = useProfessionalDirectory({ categoryId: catId, subcategoryId: subId });

  const goToSubcategory = (nextCatId, nextSubId) => {
    setCatId(nextCatId);
    setSubId(nextSubId);
    navigate(`/profesionales/categoria?cat=${nextCatId}&sub=${nextSubId}`);
  };

  const [navQuery, setNavQuery] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? directory.list.filter((p) => `${p.name} ${p.headline}`.toLowerCase().includes(q)) : directory.list;
  }, [directory.list, search]);

  if (!category || !sub) {
    return (
      <PageShell user={user} onLogout={onLogout}>
        <div className="subcat-page">
          <button type="button" className="subcat-back" onClick={() => navigate('/profesionales')}>
            <ArrowLeft size={18} aria-hidden="true" />
            Volver a Profesionales
          </button>
          <p className="a-empty">{categoriesLoading ? 'Cargando…' : 'No encontramos esa categoría.'}</p>
        </div>
      </PageShell>
    );
  }

  const Icon = CATEGORY_ICONS[category.icon] ?? CATEGORY_ICONS.Ellipsis;
  const accent = sub.color ?? category.color ?? DEFAULT_SUBCATEGORY_COLOR;
  const headImage = CATEGORY_IMAGES[CATEGORY_IMAGE_KEYS[category.id]];

  return (
    <PageShell user={user} onLogout={onLogout} query={navQuery} onQuery={setNavQuery} hideCart>
      <div className="subcat-page">
        <button type="button" className="subcat-back" onClick={() => navigate('/profesionales')}>
          <ArrowLeft size={18} aria-hidden="true" />
          Volver a Profesionales
        </button>

        <header className={`subcat-head${headImage ? ' has-image' : ''}`}>
          {headImage && <img className="subcat-head-art" src={headImage} alt="" aria-hidden="true" />}
          <div className="subcat-head-content">
            <span className="subcat-head-ico" style={{ background: accent }}>
              <Icon size={24} color="#fff" aria-hidden="true" />
            </span>
            <div>
              <h1>{sub.label}</h1>
              <p>Profesionales de {sub.label.toLowerCase()} disponibles en Neira, Caldas.</p>
            </div>
          </div>
        </header>

        <div className="subcat-filters">
          <form className="subcat-search" onSubmit={(e) => e.preventDefault()}>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              placeholder={`Buscar en ${sub.label.toLowerCase()}...`}
              aria-label="Buscar profesionales"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" aria-label="Buscar">
              <Search size={16} aria-hidden="true" />
            </button>
          </form>
          {category.subcategories.length > 1 && (
            <SpecialtySelect
              subcategories={category.subcategories}
              value={sub.id}
              onChange={(nextSubId) => goToSubcategory(category.id, nextSubId)}
            />
          )}
        </div>

        {directory.loading ? (
          <p className="a-empty">Cargando profesionales…</p>
        ) : directory.error ? (
          <p className="a-empty" role="alert">
            {directory.error}
          </p>
        ) : filtered.length === 0 ? (
          <p className="a-empty">
            {search.trim() ? 'No encontramos profesionales con ese nombre.' : `Todavía no hay profesionales de ${sub.label.toLowerCase()} en NeirAPP.`}
          </p>
        ) : (
          <div className="subcat-grid">
            {filtered.map((pro) => (
              <article key={pro.id} className={`subcat-card${pro.featured ? ' is-featured' : ''}`}>
                {pro.featured && <span className="subcat-featured">Destacado</span>}
                <div className="subcat-avatar" aria-hidden="true">
                  {pro.photo ? <img src={pro.photo} alt="" /> : <User size={30} />}
                </div>
                <h3>{pro.name}</h3>
                <span className={`subcat-status${pro.available ? ' on' : ''}`}>
                  <i aria-hidden="true" />
                  {pro.available ? 'Disponible' : 'No disponible'}
                </span>
                <p className="subcat-specialty">{sub.label}</p>
                <p className="subcat-info">
                  {[pro.headline, pro.experienceYears != null && `${pro.experienceYears} ${pro.experienceYears === 1 ? 'año' : 'años'} de experiencia`, 'Neira, Caldas']
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <div className="subcat-actions">
                  <a className="subcat-btn" href={telLink(pro.phone)}>
                    <Phone size={15} aria-hidden="true" />
                    Llamar
                  </a>
                  <a className="subcat-btn whatsapp" href={whatsappLink(pro.whatsapp)} target="_blank" rel="noreferrer">
                    <MessageCircle size={15} aria-hidden="true" />
                    WhatsApp
                  </a>
                  <button type="button" className="subcat-btn ghost" onClick={() => navigate(`/profesionales/perfil?id=${pro.id}`)}>
                    Ver perfil
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <nav className="subcat-pagination" aria-label="Paginación">
          <button type="button" disabled>
            ‹
          </button>
          <button type="button" className="on">
            1
          </button>
          <button type="button" disabled>
            ›
          </button>
        </nav>
      </div>
    </PageShell>
  );
}

// Selector de especialidad con la estética de la app (el <select> nativo no se puede vestir con el
// mismo estilo de tarjetas/dropdowns que el resto de la página; este reemplaza su lista de opciones por
// un menú propio, igual que el del usuario en el navbar).
function SpecialtySelect({ subcategories, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = subcategories.find((s) => s.id === value);

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
    <div ref={ref} className="subcat-select">
      <button
        type="button"
        className="subcat-select-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filtrar por especialidad"
        onClick={() => setOpen((v) => !v)}
      >
        {current?.label ?? 'Especialidad'}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul className="subcat-select-panel" role="listbox">
          {subcategories.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                role="option"
                aria-selected={s.id === value}
                className={s.id === value ? 'on' : ''}
                onClick={() => {
                  onChange(s.id);
                  setOpen(false);
                }}
              >
                {s.label}
                {s.id === value && <Check size={16} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

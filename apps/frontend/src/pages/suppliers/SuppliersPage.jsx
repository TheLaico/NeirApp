import { Building2, ChevronDown, ChevronLeft, ChevronRight, Eye, Handshake, Images, LayoutGrid, Phone, Settings, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import banner from '../../assets/Proveedores/fondo-card-proveedores.webp';
import fondoBuscador from '../../assets/fondo-buscador.png';
import Lightbox from '../../components/common/Lightbox.jsx';
import { FacebookIcon, InstagramIcon, WhatsappIcon } from '../../components/icons/SocialIcons.jsx';
import PageShell from '../../components/layout/PageShell.jsx';
import { suppliersApi } from '../../features/suppliers/api.js';
import { CATEGORIES, MAIN_CATEGORIES, categoryOf, initials, whatsappLink } from '../../features/suppliers/model.js';
import { useNavigate } from '../../lib/router.jsx';
import { contactRows } from './contact.js';
import './suppliers.css';

const PER_PAGE = 6;
const normalize = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Proveedores: empresas de Neira que venden al por mayor a negocios y personas. No hay carrito: NeirAPP les da
 * visibilidad y los clientes los contactan por teléfono, WhatsApp o redes, y ven su catálogo (una imagen tipo brochure).
 */
export default function SuppliersPage({ user, onLogout }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [contact, setContact] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const isSupplier = user.roles?.includes('supplier');

  const load = useCallback(async () => {
    try {
      setState({ list: await suppliersApi.list(), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const q = normalize(query.trim());
    return state.list.filter(
      (s) => (category === 'all' || s.category === category) && (!q || normalize(`${s.company_name} ${s.tagline} ${s.description}`).includes(q)),
    );
  }, [state.list, query, category]);

  // Al filtrar se vuelve a la primera página.
  useEffect(() => setPage(1), [query, category]);
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const current = shown.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <PageShell user={user} onLogout={onLogout} query={query} onQuery={setQuery} flush heroImage={fondoBuscador} centerLogo className="sp-view">
      <div className="sp-page">
        <section className="sp-hero" aria-labelledby="sp-title">
          <h1 id="sp-title" className="sp-sr">
            Proveedores: productos locales al por mayor
          </h1>
          <img className="sp-hero-img" src={banner} alt="Proveedores, productos locales al por mayor" />
          <div className="sp-hero-foot">
            <p>Encuentra empresas de Neira que ofrecen productos a la venta por mayor para negocios y personas. Escríbeles directo, mira su catálogo y cuadra tu pedido con ellos.</p>
            <span className="sp-script">
              <Handshake size={30} aria-hidden="true" />
              Apoyemos lo nuestro
            </span>
            {isSupplier && (
              <button type="button" className="sp-btn primary" onClick={() => navigate('/proveedor')}>
                <Settings size={16} aria-hidden="true" /> Administrar mi empresa
              </button>
            )}
          </div>
        </section>

        <CategoryBar value={category} onChange={setCategory} />

        {state.loading ? (
          <p className="sp-empty">Cargando proveedores…</p>
        ) : state.error ? (
          <div className="sp-empty">
            <p role="alert">{state.error}</p>
            <button type="button" className="sp-btn outline" onClick={load}>
              Reintentar
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="sp-empty">
            <Building2 size={40} aria-hidden="true" />
            <p>{state.list.length ? 'No hay proveedores que coincidan con tu búsqueda.' : 'Muy pronto verás aquí a los proveedores de Neira.'}</p>
          </div>
        ) : (
          <>
            <ul className="sp-grid">
              {current.map((s) => (
                <li key={s.user_id}>
                  <SupplierCard supplier={s} onOpen={() => navigate(`/proveedores/empresa?id=${s.user_id}`)} onContact={() => setContact(s)} onCatalog={() => setCatalog(s)} />
                </li>
              ))}
            </ul>
            {pages > 1 && (
              <nav className="sp-pages" aria-label="Páginas">
                <button type="button" aria-label="Página anterior" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft size={20} aria-hidden="true" />
                </button>
                {Array.from({ length: pages }, (_, n) => n + 1).map((n) => (
                  <button key={n} type="button" className={n === page ? 'on' : ''} aria-current={n === page ? 'page' : undefined} onClick={() => setPage(n)}>
                    {n}
                  </button>
                ))}
                <button type="button" aria-label="Página siguiente" disabled={page === pages} onClick={() => setPage(page + 1)}>
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </nav>
            )}
          </>
        )}
      </div>

      {contact && <ContactDialog supplier={contact} onClose={() => setContact(null)} />}
      {catalog && <Lightbox images={[{ id: 0, url: catalog.catalog_url, caption: `Catálogo de ${catalog.company_name}` }]} index={0} onIndex={() => {}} onClose={() => setCatalog(null)} />}
    </PageShell>
  );
}

/** Filtro por categoría: "Todos", las principales como botones y el resto en "Más". */
function CategoryBar({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const main = CATEGORIES.slice(0, MAIN_CATEGORIES);
  const more = CATEGORIES.slice(MAIN_CATEGORIES);
  const moreActive = more.find((c) => c.id === value);

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
    <div className="sp-cats" role="toolbar" aria-label="Categorías">
      <button type="button" className={value === 'all' ? 'on' : ''} aria-pressed={value === 'all'} onClick={() => onChange('all')}>
        <LayoutGrid size={20} aria-hidden="true" /> Todos
      </button>
      {main.map(({ id, label, Icon }) => (
        <button key={id} type="button" className={value === id ? 'on' : ''} aria-pressed={value === id} onClick={() => onChange(id)}>
          <Icon size={19} aria-hidden="true" /> {label}
        </button>
      ))}
      <div className="sp-more" ref={ref}>
        <button type="button" className={moreActive ? 'on' : ''} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {moreActive ? moreActive.label : 'Más'} <ChevronDown size={17} aria-hidden="true" />
        </button>
        {open && (
          <ul className="sp-more-list" role="listbox" aria-label="Más categorías">
            {more.map(({ id, label, Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === id}
                  className={value === id ? 'on' : ''}
                  onClick={() => {
                    onChange(id);
                    setOpen(false);
                  }}
                >
                  <Icon size={17} aria-hidden="true" /> {label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SupplierCard({ supplier: s, onOpen, onContact, onCatalog }) {
  const cat = categoryOf(s.category);
  return (
    <article className="sp-card">
      <div className="sp-cover" style={{ '--tint': cat.color }}>
        {s.cover_url ? <img src={s.cover_url} alt="" loading="lazy" /> : <cat.Icon size={46} aria-hidden="true" className="sp-cover-icon" />}
        <span className="sp-chip">{cat.label}</span>
      </div>
      <div className="sp-card-main">
        <button type="button" className="sp-logo" onClick={onOpen} aria-label={`Ver ${s.company_name}`}>
          {s.logo_url ? <img src={s.logo_url} alt="" /> : <span style={{ color: cat.color }}>{initials(s.company_name)}</span>}
        </button>
        <div className="sp-card-text">
          <h3>
            <button type="button" className="sp-name" onClick={onOpen}>
              {s.company_name}
            </button>
          </h3>
          {s.tagline && <p className="sp-tagline">{s.tagline}</p>}
          <p className="sp-desc">{s.description}</p>
        </div>
      </div>
      <div className="sp-card-foot">
        <button type="button" className="sp-contact" onClick={onContact}>
          <Phone size={19} aria-hidden="true" /> Contacto
        </button>
        <span className="sp-socials">
          {s.facebook && (
            <a href={s.facebook} target="_blank" rel="noreferrer" aria-label={`Facebook de ${s.company_name}`}>
              <FacebookIcon size={26} />
            </a>
          )}
          {s.instagram && (
            <a href={s.instagram} target="_blank" rel="noreferrer" aria-label={`Instagram de ${s.company_name}`}>
              <InstagramIcon size={26} />
            </a>
          )}
          {s.whatsapp && (
            <a href={whatsappLink(s.whatsapp, s.company_name)} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${s.company_name}`}>
              <WhatsappIcon size={26} />
            </a>
          )}
        </span>
      </div>
      <div className="sp-card-actions">
        <button type="button" className="sp-btn primary" onClick={onOpen}>
          <Eye size={16} aria-hidden="true" /> Ver empresa
        </button>
        <button type="button" className="sp-btn outline" disabled={!s.catalog_url} onClick={onCatalog}>
          <Images size={16} aria-hidden="true" /> {s.catalog_url ? 'Ver catálogo' : 'Sin catálogo'}
        </button>
      </div>
    </article>
  );
}

/** Todas las formas de contactar a la empresa. */
function ContactDialog({ supplier: s, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const cat = categoryOf(s.category);
  const rows = contactRows(s);

  return (
    <div className="sp-scrim" onClick={onClose}>
      <div className="sp-dialog" role="dialog" aria-modal="true" aria-labelledby="sp-contact-title" onClick={(e) => e.stopPropagation()}>
        <div className="sp-dialog-head">
          <span className="sp-logo small">{s.logo_url ? <img src={s.logo_url} alt="" /> : <span style={{ color: cat.color }}>{initials(s.company_name)}</span>}</span>
          <div>
            <h2 id="sp-contact-title">{s.company_name}</h2>
            <p>{s.tagline || cat.label}</p>
          </div>
          <button type="button" className="sp-close" aria-label="Cerrar" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <ul className="sp-contact-list">
          {rows.map(({ key, Icon, label, value, href, external }) => (
            <li key={key}>
              <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
                <span className="sp-contact-ico">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="sp-note">NeirAPP solo te conecta con la empresa: los pedidos, precios y pagos se acuerdan directamente con ellos.</p>
      </div>
    </div>
  );
}

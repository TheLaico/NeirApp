import { CalendarCheck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import HeroSearch from '../../components/common/HeroSearch.jsx';
import PageShell from '../../components/layout/PageShell.jsx';
import fondoBuscador from '../../assets/fondo-buscador.png';
import { CATEGORY_ICONS, DEFAULT_SUBCATEGORY_COLOR, useProfessionalCategories } from '../../features/professionals/categories.js';
import { useNavigate } from '../../lib/router.jsx';
import fondo from '../../assets/professionals/fondo.png';
import './professionals-page.css';

// Ejemplos que se "escriben" solos en el buscador ("Busca un abogado…") para sugerir qué se puede buscar.
const SEARCH_EXAMPLES = ['un abogado', 'un médico general', 'un contador público', 'una psicóloga', 'un arquitecto', 'un profesor particular'];

/**
 * Página "Profesionales": directorio de expertos locales (todavía sin datos reales detrás; por ahora
 * es la portada con la búsqueda y las categorías, listas para cuando exista el directorio).
 */
export default function ProfessionalsPage({ user, onLogout }) {
  const { categories } = useProfessionalCategories();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [openCatId, setOpenCatId] = useState(null);
  const openCat = categories.find((cat) => cat.id === openCatId) ?? null;

  const heroCats = useMemo(
    () => categories.map(({ id, label, icon, color }) => ({ id, label, color, Icon: CATEGORY_ICONS[icon] ?? CATEGORY_ICONS.Ellipsis })),
    [categories],
  );

  // Las categorías reaccionan a lo que se escribe: solo se muestran las que coinciden.
  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((cat) => cat.label.toLowerCase().includes(q));
  }, [categories, search]);

  return (
    <PageShell user={user} onLogout={onLogout} hideCart flush heroImage={fondoBuscador} centerLogo className="pros-view">
      <div className="pros-page">
        {/* El mismo buscador del inicio (píldora con micrófono sobre el fondo de montañas) y, debajo, las
            categorías de profesionales en la pasarela que se desliza sola. */}
        <HeroSearch
          value={search}
          onChange={setSearch}
          placeholder="Busca por profesión, nombre o especialidad"
          ariaLabel="Buscar profesionales"
          examples={SEARCH_EXAMPLES}
          cats={heroCats}
          onSelectCat={setOpenCatId}
        />

        <div className="pros-body">
        <section className="pros-hero">
          <img className="pros-hero-art" src={fondo} alt="" aria-hidden="true" />
          <div className="pros-hero-text">
            <h1>Profesionales</h1>
            <p className="pros-tagline">Encuentra el experto que necesitas en Neira.</p>
            <p className="pros-desc">
              Conecta con profesionales de confianza de diferentes áreas. Revisa su información, especialidades y
              contáctalos de forma rápida y sencilla.
            </p>
            <button type="button" className="pros-my-requests" onClick={() => navigate('/profesionales/mis-solicitudes')}>
              <CalendarCheck size={16} aria-hidden="true" /> Mis solicitudes de cita
            </button>
          </div>
        </section>


        <section className="pros-categories">
          <h2>Explora por categoría</h2>
          <div className="pros-cat-grid">
            {filteredCategories.map(({ id, label, icon, color }) => {
              const Icon = CATEGORY_ICONS[icon] ?? CATEGORY_ICONS.Ellipsis;
              return (
                <button key={`${search}-${id}`} type="button" className="pros-cat" onClick={() => setOpenCatId(id)}>
                  <span className="pros-cat-ico" style={{ background: color }}>
                    <Icon size={20} color="#fff" aria-hidden="true" />
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
          {filteredCategories.length === 0 && (
            <p className="pros-cat-empty">No encontramos categorías que coincidan con “{search}”.</p>
          )}
        </section>
        </div>
      </div>

      {openCat && <SubcategoriesModal category={openCat} onClose={() => setOpenCatId(null)} />}
    </PageShell>
  );
}

// Ventana emergente con las subcategorías/carreras de la categoría elegida. Ese listado se administra
// desde "Gestión de profesionales" en el panel de administrador (ver features/professionals/categories.js).
function SubcategoriesModal({ category, onClose }) {
  const Icon = CATEGORY_ICONS[category.icon] ?? CATEGORY_ICONS.Ellipsis;
  const navigate = useNavigate();
  return (
    <div className="pros-sub-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pros-sub-modal" role="dialog" aria-modal="true" aria-labelledby="pros-sub-title">
        <button type="button" className="pros-sub-close" onClick={onClose} aria-label="Cerrar">
          <X size={20} aria-hidden="true" />
        </button>
        <div className="pros-sub-head">
          <span className="pros-cat-ico" style={{ background: category.color }}>
            <Icon size={20} color="#fff" aria-hidden="true" />
          </span>
          <h2 id="pros-sub-title">{category.label}</h2>
        </div>
        {category.subcategories.length === 0 ? (
          <p className="pros-sub-empty">Todavía no hay subcategorías cargadas para {category.label.toLowerCase()}.</p>
        ) : (
          <ul className="pros-sub-list">
            {category.subcategories.map((sub) => (
              <li key={sub.id}>
                <button
                  type="button"
                  style={{ borderLeftColor: sub.color ?? DEFAULT_SUBCATEGORY_COLOR }}
                  onClick={() => navigate(`/profesionales/categoria?cat=${category.id}&sub=${sub.id}`)}
                >
                  <span className="pros-sub-dot" style={{ background: sub.color ?? DEFAULT_SUBCATEGORY_COLOR }} />
                  {sub.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

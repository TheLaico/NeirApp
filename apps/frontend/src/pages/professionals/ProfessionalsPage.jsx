import { Mic, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import { CATEGORY_ICONS, DEFAULT_SUBCATEGORY_COLOR, useProfessionalCategories } from '../../features/professionals/categories.js';
import { useNavigate } from '../../lib/router.jsx';
import fondo from '../../assets/professionals/fondo.png';
import './professionals-page.css';

// Ejemplos que se "escriben" solos en el buscador para sugerir qué se puede buscar.
const SEARCH_EXAMPLES = [
  'Abogado en Neira',
  'Médico general',
  'Contador público',
  'Psicólogo',
  'Arquitecto',
  'Profesor particular',
];

/**
 * Página "Profesionales": directorio de expertos locales (todavía sin datos reales detrás; por ahora
 * es la portada con la búsqueda y las categorías, listas para cuando exista el directorio).
 */
export default function ProfessionalsPage({ user, onLogout }) {
  const [categories] = useProfessionalCategories();
  const [navQuery, setNavQuery] = useState('');
  const [search, setSearch] = useState('');
  const [placeholder, setPlaceholder] = useState('Buscar por profesión, nombre o especialidad...');
  const [listening, setListening] = useState(false);
  const [openCatId, setOpenCatId] = useState(null);
  const recognitionRef = useRef(null);
  const isEmpty = search.trim().length === 0;
  const openCat = categories.find((cat) => cat.id === openCatId) ?? null;

  // Animación de "máquina de escribir": mientras el buscador está vacío, va mostrando ejemplos
  // de búsqueda en el placeholder para sugerirle al usuario qué puede escribir.
  useEffect(() => {
    if (!isEmpty) return undefined;
    let exampleIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeoutId;

    const tick = () => {
      const word = SEARCH_EXAMPLES[exampleIndex];
      if (!deleting) {
        charIndex += 1;
        setPlaceholder(`Ej: ${word.slice(0, charIndex)}`);
        timeoutId = setTimeout(tick, charIndex === word.length ? 1400 : 70);
        if (charIndex === word.length) deleting = true;
      } else {
        charIndex -= 1;
        setPlaceholder(`Ej: ${word.slice(0, charIndex)}`);
        if (charIndex === 0) {
          deleting = false;
          exampleIndex = (exampleIndex + 1) % SEARCH_EXAMPLES.length;
          timeoutId = setTimeout(tick, 300);
        } else {
          timeoutId = setTimeout(tick, 35);
        }
      }
    };

    timeoutId = setTimeout(tick, 500);
    return () => clearTimeout(timeoutId);
  }, [isEmpty]);

  // Búsqueda por voz (Web Speech API); en navegadores sin soporte el botón simplemente no hace nada.
  const toggleMic = () => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-CO';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => setSearch(e.results[0][0].transcript);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  // Las categorías reaccionan a lo que se escribe: solo se muestran las que coinciden.
  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((cat) => cat.label.toLowerCase().includes(q));
  }, [categories, search]);

  return (
    <PageShell user={user} onLogout={onLogout} query={navQuery} onQuery={setNavQuery} hideCart flush className="pros-view">
      <div className="pros-page">
        <section className="pros-hero">
          <img className="pros-hero-art" src={fondo} alt="" aria-hidden="true" />
          <div className="pros-hero-text">
            <h1>Profesionales</h1>
            <p className="pros-tagline">Encuentra el experto que necesitas en Neira.</p>
            <p className="pros-desc">
              Conecta con profesionales de confianza de diferentes áreas. Revisa su información, especialidades y
              contáctalos de forma rápida y sencilla.
            </p>
          </div>
        </section>

        {/* Fuera de la portada (no en `.pros-hero-text`): adentro competía por ancho con la ilustración,
            así que en celular quedaba angosto y apretado. Acá tiene todo el ancho de la página para él solo. */}
        <form className="pros-search" onSubmit={(e) => e.preventDefault()}>
          <Search size={20} aria-hidden="true" />
          <input
            type="search"
            placeholder={placeholder}
            aria-label="Buscar profesionales"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className={`pros-search-mic${listening ? ' is-listening' : ''}`}
            aria-label={listening ? 'Detener dictado por voz' : 'Buscar por voz'}
            onClick={toggleMic}
          >
            <Mic size={18} aria-hidden="true" />
          </button>
          <button type="submit" aria-label="Buscar">
            <Search size={18} aria-hidden="true" />
          </button>
        </form>

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

import { ArrowLeft, BadgeCheck, Briefcase, Clock, Home, Mail, MapPin, MessageCircle, Monitor, Phone, Star, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import { professionalsApi } from '../../features/professionals/api.js';
import { CATEGORY_ICONS, DEFAULT_SUBCATEGORY_COLOR, useProfessionalCategories } from '../../features/professionals/categories.js';
import { telLink, toCard, whatsappLink } from '../../features/professionals/directory.js';
import { useNavigate } from '../../lib/router.jsx';
import './professional-profile.css';
import './subcategory-page.css'; // botones de contacto, estado y "Volver" compartidos con el listado

const MODES = [
  { key: 'office', label: 'En consultorio u oficina', Icon: Briefcase },
  { key: 'home', label: 'A domicilio', Icon: Home },
  { key: 'online', label: 'Virtual', Icon: Monitor },
];

const mapsLink = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, Neira, Caldas`)}`;

/**
 * "Ver perfil": toda la información que el profesional publicó desde su panel, con sus datos de contacto.
 * La ruta es /profesionales/perfil?id=<user_id> (el router solo mira el pathname, como en /profesionales/categoria).
 */
export default function ProfessionalProfilePage({ user, onLogout }) {
  const navigate = useNavigate();
  const [id] = useState(() => new URLSearchParams(window.location.search).get('id'));
  const [state, setState] = useState({ profile: null, loading: true, error: '' });
  const { categories } = useProfessionalCategories();

  useEffect(() => {
    let alive = true;
    professionalsApi
      .get(id)
      .then((p) => alive && setState({ profile: p, loading: false, error: '' }))
      .catch((err) => alive && setState({ profile: null, loading: false, error: err.status === 404 || err.status === 422 ? 'Este perfil ya no está disponible.' : err.message }));
    return () => {
      alive = false;
    };
  }, [id]);

  const p = state.profile;
  const card = p && toCard(p);
  const category = p && categories.find((c) => c.id === p.category_id);
  const sub = category?.subcategories.find((s) => s.id === p.subcategory_id);
  const Icon = CATEGORY_ICONS[category?.icon] ?? CATEGORY_ICONS.Ellipsis;
  const accent = sub?.color ?? category?.color ?? DEFAULT_SUBCATEGORY_COLOR;

  const back = () => (category && sub ? navigate(`/profesionales/categoria?cat=${category.id}&sub=${sub.id}`) : navigate('/profesionales'));

  return (
    <PageShell user={user} onLogout={onLogout} hideCart>
      <div className="pp-page">
        <button type="button" className="subcat-back pp-back" onClick={back}>
          <ArrowLeft size={18} aria-hidden="true" />
          {sub ? `Volver a ${sub.label}` : 'Volver a Profesionales'}
        </button>

        {state.loading ? (
          <p className="a-empty">Cargando perfil…</p>
        ) : !p ? (
          <p className="a-empty" role="alert">
            {state.error}
          </p>
        ) : (
          <div className="pp-layout">
            <section className="pp-hero" style={{ '--accent': accent }}>
              <div className="pp-hero-band" aria-hidden="true">
                <span className="pp-hero-ico">
                  <Icon size={22} color="#fff" />
                </span>
              </div>
              <div className="pp-hero-body">
                <div className="pp-photo">{card.photo ? <img src={card.photo} alt={`Foto de ${card.name}`} /> : <User size={52} aria-hidden="true" />}</div>
                <div className="pp-hero-text">
                  <div className="pp-tags">
                    {card.featured && (
                      <span className="pp-featured">
                        <Star size={13} fill="currentColor" aria-hidden="true" /> Destacado
                      </span>
                    )}
                    <span className={`subcat-status${card.available ? ' on' : ''}`}>
                      <i aria-hidden="true" />
                      {card.available ? 'Disponible' : 'No disponible'}
                    </span>
                  </div>
                  <h1>
                    {card.name} <BadgeCheck size={22} className="pp-verified" aria-label="Profesional verificado por NeirAPP" />
                  </h1>
                  <p className="pp-specialty">{[category?.label, sub?.label].filter(Boolean).join(' · ')}</p>
                  {p.headline && <p className="pp-headline">{p.headline}</p>}
                  <p className="pp-meta">
                    {p.experience_years != null && (
                      <span>
                        <Briefcase size={15} aria-hidden="true" /> {p.experience_years} {p.experience_years === 1 ? 'año' : 'años'} de experiencia
                      </span>
                    )}
                    <span>
                      <MapPin size={15} aria-hidden="true" /> Neira, Caldas
                    </span>
                  </p>
                </div>
              </div>
            </section>

            <aside className="pp-contact" aria-label="Contactar">
              <h2>Contactar</h2>
              <a className="subcat-btn" href={telLink(card.phone)}>
                <Phone size={16} aria-hidden="true" /> Llamar
              </a>
              <a className="subcat-btn whatsapp" href={whatsappLink(card.whatsapp, `Hola ${card.name}, te encontré en NeirAPP.`)} target="_blank" rel="noreferrer">
                <MessageCircle size={16} aria-hidden="true" /> Escribir por WhatsApp
              </a>
              {p.email && (
                <a className="subcat-btn ghost" href={`mailto:${p.email}`}>
                  <Mail size={16} aria-hidden="true" /> Enviar correo
                </a>
              )}
              <p className="pp-contact-note">Cuéntale que lo encontraste en NeirAPP.</p>
            </aside>

            <div className="pp-main">
              {p.description && (
                <section className="pp-card">
                  <h2>Sobre {p.full_name.split(' ')[0]}</h2>
                  <p className="pp-description">{p.description}</p>
                </section>
              )}

              <section className="pp-card">
                <h2>Cómo atiende</h2>
                <ul className="pp-modes">
                  {MODES.filter((m) => p.modalities[m.key]).map(({ key, label, Icon: ModeIcon }) => (
                    <li key={key}>
                      <ModeIcon size={18} aria-hidden="true" /> {label}
                    </li>
                  ))}
                </ul>
              </section>

              {(p.schedule || p.address) && (
                <section className="pp-card pp-details">
                  {p.schedule && (
                    <div>
                      <Clock size={20} aria-hidden="true" />
                      <span>
                        <strong>Horario</strong>
                        {p.schedule}
                      </span>
                    </div>
                  )}
                  {p.address && (
                    <div>
                      <MapPin size={20} aria-hidden="true" />
                      <span>
                        <strong>Dirección</strong>
                        {p.address}
                        <a href={mapsLink(p.address)} target="_blank" rel="noreferrer">
                          Ver en el mapa
                        </a>
                      </span>
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

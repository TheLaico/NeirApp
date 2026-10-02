import { ArrowLeft, BadgeCheck, CalendarCheck, Briefcase, Clock, Home, Mail, MapPin, MessageCircle, Monitor, Phone, Star, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import Lightbox from '../../components/common/Lightbox.jsx';
import PageShell from '../../components/layout/PageShell.jsx';
import { professionalsApi } from '../../features/professionals/api.js';
import { CATEGORY_ICONS, DEFAULT_SUBCATEGORY_COLOR, useProfessionalCategories } from '../../features/professionals/categories.js';
import { telLink, toCard, whatsappLink } from '../../features/professionals/directory.js';
import { isPdf, issuerLine, kindOf } from '../../features/professionals/certificates.js';
import { durationLabel, fromApi as serviceFromApi, priceLabel } from '../../features/professionals/services.js';
import { useNavigate } from '../../lib/router.jsx';
import RequestDialog from './RequestDialog.jsx';
import './professional-profile.css';
import './subcategory-page.css'; // botones de contacto, estado y "Volver" compartidos con el listado

const MODES = [
  { key: 'office', label: 'En consultorio u oficina', Icon: Briefcase },
  { key: 'home', label: 'A domicilio', Icon: Home },
  { key: 'online', label: 'Virtual', Icon: Monitor },
];

// Cuántas fotos se ven en la página; la última muestra "+N" si hay más (todas se ven en el visor).
const GALLERY_PREVIEW = 6;

const mapsLink = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, Neira, Caldas`)}`;

/**
 * "Ver perfil": toda la información que el profesional publicó desde su panel, con sus datos de contacto.
 * La ruta es /profesionales/perfil?id=<user_id> (el router solo mira el pathname, como en /profesionales/categoria).
 */
export default function ProfessionalProfilePage({ user, onLogout }) {
  const navigate = useNavigate();
  const [id] = useState(() => new URLSearchParams(window.location.search).get('id'));
  const [state, setState] = useState({ profile: null, loading: true, error: '' });
  const [services, setServices] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [viewer, setViewer] = useState(null);
  const [asking, setAsking] = useState(false);
  const { categories } = useProfessionalCategories();

  useEffect(() => {
    let alive = true;
    // El propio profesional ve su perfil aunque lo tenga oculto en el directorio.
    (id === user.id ? professionalsApi.mine() : professionalsApi.get(id))
      .then((p) => alive && setState({ profile: p, loading: false, error: '' }))
      .catch((err) => alive && setState({ profile: null, loading: false, error: err.status === 404 || err.status === 422 ? 'Este perfil ya no está disponible.' : err.message }));
    // Los servicios son un extra: si fallan, el perfil se ve igual, sin esa sección.
    professionalsApi
      .services(id)
      .then((list) => alive && setServices(list.map(serviceFromApi)))
      .catch(() => {});
    professionalsApi
      .gallery(id)
      .then((list) => alive && setGallery(list))
      .catch(() => {});
    professionalsApi
      .certificates(id)
      .then((list) => alive && setCertificates(list))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id, user.id]);

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
                    {card.name}
                    {certificates.length > 0 && (
                      <span className="pp-verified-tag" title="NeirAPP revisó sus certificados">
                        <BadgeCheck size={18} aria-hidden="true" /> Verificado
                      </span>
                    )}
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
              {p.user_id !== user.id && p.plan !== 'basic' &&
                (p.accepts_requests ? (
                  <button type="button" className="subcat-btn pp-request" onClick={() => setAsking(true)}>
                    <CalendarCheck size={16} aria-hidden="true" /> Pedir una cita
                  </button>
                ) : (
                  <p className="pp-paused">Por ahora no está recibiendo solicitudes de cita. Puedes llamarle o escribirle.</p>
                ))}
              {p.user_id === user.id && !p.plan && <p className="pp-paused">Tu perfil no se publica: no tienes un plan activo. Elige uno en Planes para profesionales.</p>}
              {p.user_id === user.id && p.plan && !p.is_listed && <p className="pp-paused">Tu perfil está oculto: solo tú lo ves. Puedes volver a mostrarlo en Configuración.</p>}
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
              <p className="pp-contact-note">
                Cuéntale que lo encontraste en NeirAPP.{' '}
                <button type="button" onClick={() => navigate('/profesionales/mis-solicitudes')}>
                  Ver mis solicitudes
                </button>
              </p>
            </aside>

            <div className="pp-main">
              {p.description && (
                <section className="pp-card">
                  <h2>Sobre {p.full_name.split(' ')[0]}</h2>
                  <p className="pp-description">{p.description}</p>
                </section>
              )}

              {gallery.length > 0 && (
                <section className="pp-card">
                  <h2>Galería</h2>
                  <ul className={`pp-gallery n${Math.min(gallery.length, GALLERY_PREVIEW)}`}>
                    {gallery.slice(0, GALLERY_PREVIEW).map((image, n) => {
                      const more = n === GALLERY_PREVIEW - 1 ? gallery.length - GALLERY_PREVIEW : 0;
                      return (
                        <li key={image.id}>
                          <button type="button" aria-label={more > 0 ? `Ver las ${gallery.length} fotos` : `Ver foto ${n + 1}${image.caption ? `: ${image.caption}` : ''}`} onClick={() => setViewer(n)}>
                            <img src={image.url} alt="" loading="lazy" />
                            {more > 0 && <span className="pp-gallery-more">+{more}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {certificates.length > 0 && (
                <section className="pp-card">
                  <h2>Formación y certificados</h2>
                  <ul className="pp-certs">
                    {certificates.map((c) => {
                      const { Icon, label } = kindOf(c.kind);
                      return (
                        <li key={c.id}>
                          <span className="pp-cert-ico">
                            <Icon size={20} aria-hidden="true" />
                          </span>
                          <div>
                            <strong>{c.title}</strong>
                            <p>{[label, issuerLine(c)].filter(Boolean).join(' · ')}</p>
                            <span className="pp-cert-ok">
                              <BadgeCheck size={14} aria-hidden="true" /> Verificado por NeirAPP
                            </span>
                          </div>
                          <a href={c.file_url} target="_blank" rel="noreferrer">
                            Ver {isPdf(c.file_url) ? 'PDF' : 'documento'}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {services.length > 0 && (
                <section className="pp-card">
                  <h2>Servicios</h2>
                  <ul className="pp-services">
                    {services.map((sv) => (
                      <li key={sv.id}>
                        <div>
                          <strong>{sv.name}</strong>
                          {sv.description && <p>{sv.description}</p>}
                          {sv.duration && (
                            <small>
                              <Clock size={13} aria-hidden="true" /> {durationLabel(sv.duration)}
                            </small>
                          )}
                        </div>
                        <span className={`pp-service-price${sv.priceKind === 'quote' ? ' quote' : ''}`}>{priceLabel(sv)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="pp-services-note">Precios de referencia. Confírmalos con el profesional.</p>
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
      {asking && p && <RequestDialog profile={p} services={services} user={user} onClose={() => setAsking(false)} />}
      {viewer !== null && <Lightbox images={gallery} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />}
    </PageShell>
  );
}

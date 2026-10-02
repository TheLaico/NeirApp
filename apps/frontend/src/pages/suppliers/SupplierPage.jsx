import { ArrowLeft, Download, Images, Maximize2, MessageCircle, Phone, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import Lightbox from '../../components/common/Lightbox.jsx';
import PageShell from '../../components/layout/PageShell.jsx';
import { suppliersApi } from '../../features/suppliers/api.js';
import { categoryOf, initials, telLink, whatsappLink } from '../../features/suppliers/model.js';
import { useNavigate } from '../../lib/router.jsx';
import { contactRows } from './contact.js';
import './suppliers.css';

/**
 * "Ver empresa": quiénes son (portada, logo, qué venden), cómo contactarlos y su catálogo completo ahí mismo, sin
 * salir de la página. La ruta es /proveedores/empresa?id=<user_id> (el router solo mira el pathname).
 */
export default function SupplierPage({ user, onLogout }) {
  const navigate = useNavigate();
  const [id] = useState(() => new URLSearchParams(window.location.search).get('id'));
  const [state, setState] = useState({ supplier: null, loading: true, error: '' });
  const [viewer, setViewer] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    suppliersApi
      .get(id)
      .then((supplier) => alive && setState({ supplier, loading: false, error: '' }))
      .catch((err) => alive && setState({ supplier: null, loading: false, error: err.status === 404 || err.status === 422 ? 'Esta empresa ya no está disponible en Proveedores.' : err.message }));
    return () => {
      alive = false;
    };
  }, [id]);

  const s = state.supplier;
  const cat = s && categoryOf(s.category);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: s.company_name, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      /* el usuario canceló */
    }
  };

  return (
    <PageShell user={user} onLogout={onLogout} flush className="sp-view">
      <div className="sp-page">
        <button type="button" className="sp-back" onClick={() => navigate('/proveedores')}>
          <ArrowLeft size={18} aria-hidden="true" /> Volver a Proveedores
        </button>

        {state.loading ? (
          <p className="sp-empty">Cargando…</p>
        ) : state.error ? (
          <div className="sp-empty">
            <p role="alert">{state.error}</p>
            <button type="button" className="sp-btn outline" onClick={() => navigate('/proveedores')}>
              Ver otros proveedores
            </button>
          </div>
        ) : (
          <article className="spd">
            <header className="spd-head">
              <div className="spd-cover" style={{ '--tint': cat.color }}>
                {s.cover_url ? <img src={s.cover_url} alt="" /> : <cat.Icon size={64} aria-hidden="true" className="sp-cover-icon" />}
              </div>
              <div className="spd-id">
                <span className="sp-logo spd-logo">{s.logo_url ? <img src={s.logo_url} alt={`Logo de ${s.company_name}`} /> : <span style={{ color: cat.color }}>{initials(s.company_name)}</span>}</span>
                <div className="spd-titles">
                  <span className="sp-chip static">
                    <cat.Icon size={14} aria-hidden="true" /> {cat.label}
                  </span>
                  <h1>{s.company_name}</h1>
                  {s.tagline && <p>{s.tagline}</p>}
                </div>
                <div className="spd-cta">
                  {s.whatsapp ? (
                    <a className="sp-btn primary whatsapp" href={whatsappLink(s.whatsapp, s.company_name)} target="_blank" rel="noreferrer">
                      <MessageCircle size={17} aria-hidden="true" /> Escribir por WhatsApp
                    </a>
                  ) : (
                    <a className="sp-btn primary" href={telLink(s.phone)}>
                      <Phone size={17} aria-hidden="true" /> Llamar
                    </a>
                  )}
                  <button type="button" className="sp-btn outline" onClick={share}>
                    <Share2 size={16} aria-hidden="true" /> {copied ? 'Enlace copiado' : 'Compartir'}
                  </button>
                </div>
              </div>
            </header>

            <div className="spd-body">
              <div className="spd-main">
                <section className="spd-card">
                  <h2>Quiénes somos</h2>
                  <p className="spd-about">{s.description}</p>
                  <p className="spd-note">
                    Venta al por mayor para negocios y personas. Los pedidos, precios, entregas y pagos se acuerdan directamente con {s.company_name}; NeirAPP solo los
                    conecta.
                  </p>
                </section>

                <section className="spd-card" aria-labelledby="spd-catalog">
                  <div className="spd-card-head">
                    <h2 id="spd-catalog">Catálogo</h2>
                    {s.catalog_url && (
                      <span className="spd-catalog-actions">
                        <button type="button" className="sp-btn outline small" onClick={() => setViewer(true)}>
                          <Maximize2 size={15} aria-hidden="true" /> Ampliar
                        </button>
                        <a className="sp-btn outline small" href={s.catalog_url} download={`catalogo-${s.company_name}.webp`}>
                          <Download size={15} aria-hidden="true" /> Descargar
                        </a>
                      </span>
                    )}
                  </div>
                  {s.catalog_url ? (
                    <button type="button" className="spd-catalog" onClick={() => setViewer(true)} aria-label="Ver el catálogo en grande">
                      <img src={s.catalog_url} alt={`Catálogo de ${s.company_name}`} />
                    </button>
                  ) : (
                    <p className="spd-empty">
                      <Images size={28} aria-hidden="true" /> {s.company_name} todavía no ha subido su catálogo. Escríbeles para conocer sus productos.
                    </p>
                  )}
                </section>
              </div>

              <aside className="spd-side">
                <section className="spd-card">
                  <h2>Contacto</h2>
                  <ul className="sp-contact-list">
                    {contactRows(s).map(({ key, Icon, label, value, href, external }) => (
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
                </section>
              </aside>
            </div>
          </article>
        )}
      </div>
      {viewer && s?.catalog_url && <Lightbox images={[{ id: 0, url: s.catalog_url, caption: `Catálogo de ${s.company_name}` }]} index={0} onIndex={() => {}} onClose={() => setViewer(false)} />}
    </PageShell>
  );
}

import { ArrowLeft, Flag, Heart, Info, Maximize2, MessageCircle, Package, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import Lightbox from '../../components/common/Lightbox.jsx';
import PageShell from '../../components/layout/PageShell.jsx';
import { marketplaceApi } from '../../features/marketplace/api.js';
import { KINDS, categoryOf, priceLabel, sellerChat, unitsLabel, useMarketFavorites } from '../../features/marketplace/model.js';
import { useNavigate } from '../../lib/router.jsx';
import ReportDialog from './ReportDialog.jsx';
import './marketplace.css';

const since = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });

/**
 * "Ver producto": fotos, precio, cuántos hay, descripción y el chat por WhatsApp con el vendedor. La ruta es
 * /marquetneira/producto?id=<id>. Su dueño la ve aunque todavía no esté publicada (para revisar cómo queda).
 */
export default function ListingPage({ user, onLogout }) {
  const navigate = useNavigate();
  const [id] = useState(() => new URLSearchParams(window.location.search).get('id'));
  const [state, setState] = useState({ item: null, loading: true, error: '' });
  const [photo, setPhoto] = useState(0);
  const [viewer, setViewer] = useState(null);
  const [reporting, setReporting] = useState(false);
  const favorites = useMarketFavorites();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const item = await marketplaceApi.get(id);
        if (alive) setState({ item, loading: false, error: '' });
      } catch (err) {
        // Si es suya (aún sin publicar o pausada), la busca entre las propias.
        const mine = err.status === 404 ? (await marketplaceApi.mine().catch(() => [])).find((m) => m.id === id) : null;
        if (!alive) return;
        if (mine) setState({ item: mine, loading: false, error: '' });
        else setState({ item: null, loading: false, error: err.status === 404 || err.status === 422 ? 'Esta publicación ya no está disponible.' : err.message });
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const item = state.item;
  const own = item?.seller_id === user.id;
  const category = item && categoryOf(item.category);

  return (
    <PageShell user={user} onLogout={onLogout} flush className="mq-view">
      <div className="mq-page mq-detail-page">
        <button type="button" className="mq-back" onClick={() => navigate('/marquetneira')}>
          <ArrowLeft size={18} aria-hidden="true" /> Volver a MarquetNeira
        </button>

        {state.loading ? (
          <p className="mq-empty">Cargando…</p>
        ) : state.error ? (
          <div className="mq-empty">
            <p role="alert">{state.error}</p>
            <button type="button" className="mq-btn outline" onClick={() => navigate('/marquetneira')}>
              Ver otros muebles
            </button>
          </div>
        ) : (
          <article className="mq-detail">
            <div className="mq-gallery">
              <div className="mq-gallery-main">
                <button type="button" className="mq-gallery-img" onClick={() => setViewer(photo)} aria-label="Ver foto en grande">
                  <img src={item.photos[photo]} alt={item.title} />
                  <span className="mq-round mq-zoom" aria-hidden="true">
                    <Maximize2 size={17} />
                  </span>
                </button>
                <span className={`mq-kind ${item.kind}`}>{KINDS[item.kind]}</span>
              </div>
              {item.photos.length > 1 && (
                <ul className="mq-thumbs">
                  {item.photos.map((url, n) => (
                    <li key={url}>
                      <button type="button" className={n === photo ? 'on' : ''} aria-label={`Foto ${n + 1}`} onClick={() => setPhoto(n)}>
                        <img src={url} alt="" loading="lazy" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mq-info">
              {own && !item.paid_until && <p className="mq-banner warn">Así se verá tu publicación. Todavía no está publicada: paga el mes en Mis publicaciones.</p>}
              {own && item.is_active === false && <p className="mq-banner warn">Tu publicación está pausada: nadie más la ve.</p>}
              <p className="mq-cat">
                <category.Icon size={16} aria-hidden="true" /> {category.label}
              </p>
              <h1>{item.title}</h1>
              <p className="mq-price big">
                <strong>{priceLabel(item)}</strong>
                {item.negotiable && <span className="mq-pill">{item.price_cop == null ? 'Lo negocias por chat' : 'Negociable'}</span>}
              </p>
              <p className="mq-line">
                <Package size={17} aria-hidden="true" /> {unitsLabel(item.quantity)}
                <span className="mq-dot" aria-hidden="true">·</span> Publicado el {since(item.created_at)}
                {item.seller_name && (
                  <>
                    <span className="mq-dot" aria-hidden="true">·</span> Vende {item.seller_name.split(' ')[0]}
                  </>
                )}
              </p>

              <h2>Descripción</h2>
              <p className="mq-description">{item.description}</p>

              <div className="mq-detail-actions">
                {own ? (
                  <button type="button" className="mq-btn primary" onClick={() => navigate('/marquetneira/mis-publicaciones')}>
                    Editar en Mis publicaciones
                  </button>
                ) : (
                  <a className="mq-btn primary whatsapp" href={sellerChat(item)} target="_blank" rel="noreferrer">
                    <MessageCircle size={18} aria-hidden="true" /> Chat con vendedor
                  </a>
                )}
                <button type="button" className={`mq-btn outline mq-heart-btn${favorites.has(item.id) ? ' on' : ''}`} aria-pressed={favorites.has(item.id)} onClick={() => favorites.toggle(item.id)}>
                  <Heart size={17} aria-hidden="true" fill={favorites.has(item.id) ? 'currentColor' : 'none'} /> {favorites.has(item.id) ? 'Guardado' : 'Guardar'}
                </button>
              </div>

              <div className="mq-safe">
                <ShieldCheck size={22} aria-hidden="true" />
                <p>
                  <b>NeirAPP solo te conecta con el vendedor:</b> no hay pagos en la plataforma. Acuerda el precio, la entrega y el pago directamente por chat, y no
                  pagues por adelantado sin ver el mueble.
                </p>
              </div>

              {!own && (
                <button type="button" className="mq-report-link" onClick={() => setReporting(true)}>
                  <Flag size={14} aria-hidden="true" /> Reportar publicación
                </button>
              )}
              {own && (
                <p className="mq-muted small">
                  <Info size={14} aria-hidden="true" /> Las personas te escribirán al WhatsApp {item.whatsapp.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3')}.
                </p>
              )}
            </div>
          </article>
        )}
      </div>

      {viewer !== null && item && (
        <Lightbox images={item.photos.map((url, n) => ({ id: n, url, caption: '' }))} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />
      )}
      {reporting && item && <ReportDialog listing={item} onClose={() => setReporting(false)} />}
    </PageShell>
  );
}

import { ImagePlus, Loader2, Star, StarOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { lodgingApi } from '../../features/lodging/api.js';
import { kindOf } from '../../features/lodging/model.js';
import { uploadImage } from '../../features/media/api.js';
import { formatCop } from '../../lib/money.js';
import AdminLayout from './AdminLayout.jsx';
import '../lodging/lodging.css';

/**
 * Hospedaje (admin): decide qué hoteles salen en "Hoteles recomendados" y la imagen de fondo de su banner. Los
 * hoteles se autorizan por correo en Roles (rol Hotel) y cada uno arma su ficha desde su panel.
 */
export default function AdminLodgingPage({ user, onLogout }) {
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setState({ list: await lodgingApi.adminHotels(), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const update = async (hotel, recommended, bannerUrl, done) => {
    setBusy(hotel.id);
    setError('');
    setNotice('');
    try {
      const saved = await lodgingApi.setRecommended(hotel.id, recommended, bannerUrl);
      setState((s) => ({ ...s, list: s.list.map((r) => (r.hotel.id === saved.id ? { ...r, hotel: saved } : r)) }));
      setNotice(done);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const recommended = state.list.filter((r) => r.hotel.is_recommended);

  return (
    <AdminLayout user={user} onLogout={onLogout} title="Hospedaje" subtitle="Elige los hoteles recomendados y el fondo de su banner. Autoriza nuevos hoteles en Roles (rol Hotel).">
      {error && (
        <p className="a-err" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="a-success" role="status">
          {notice}
        </p>
      )}

      <section className="a-card">
        <h2>Hoteles recomendados {recommended.length > 0 && <span className="a-count">{recommended.length}</span>}</h2>
        <p className="a-card-hint">Salen primero en Hospedaje, en el carrusel de arriba, con la imagen de fondo que subas (horizontal, mínimo 1200 px de ancho). Sin fondo se usa su foto principal.</p>
        {state.loading ? (
          <p className="a-empty">Cargando…</p>
        ) : state.error ? (
          <p className="a-err">{state.error}</p>
        ) : state.list.length === 0 ? (
          <p className="a-empty">Todavía ningún hotel ha creado su ficha.</p>
        ) : (
          <ul className="a-store-list">
            {state.list.map((row) => (
              <HotelAdminRow key={row.hotel.id} row={row} busy={busy === row.hotel.id} onUpdate={update} />
            ))}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
}

function HotelAdminRow({ row: { hotel: h, has_access: hasAccess }, busy, onUpdate }) {
  const input = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const visible = hasAccess && h.is_listed;

  const pick = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadImage(file);
      await onUpdate(h, true, url, `✓ Nuevo fondo para el banner de ${h.name}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <li className="a-store a-cert">
      <div className="a-store-row">
        {h.photos[0] && <img className="a-mq-photo" src={h.photos[0]} alt="" />}
        <div className="a-store-info">
          <strong>{h.name}</strong>
          <span>
            {kindOf(h.kind).label} · desde {formatCop(h.price_from_cop)} · {h.reviews_count ? `${h.rating.toLocaleString('es-CO')} ★ (${h.reviews_count})` : 'sin reseñas'}
            {!h.is_listed && ' · oculto por el hotel'}
            {!hasAccess && ' · la cuenta no tiene el rol Hotel (autorízala en Roles)'}
          </span>
        </div>
        <span className={`a-badge ${visible ? 'plan-pro' : 'plan-none'}`}>{visible ? 'Visible' : 'No aparece'}</span>
        {h.is_recommended ? (
          <button type="button" className="a-btn danger-ghost" disabled={busy} onClick={() => onUpdate(h, false, h.banner_url, `${h.name} ya no es recomendado.`)}>
            {busy ? <Loader2 size={16} className="a-spin" aria-hidden="true" /> : <StarOff size={16} aria-hidden="true" />} Quitar de recomendados
          </button>
        ) : (
          <button type="button" className="a-btn primary" disabled={busy} onClick={() => onUpdate(h, true, h.banner_url, `✓ ${h.name} ahora es recomendado.`)}>
            {busy ? <Loader2 size={16} className="a-spin" aria-hidden="true" /> : <Star size={16} aria-hidden="true" />} Recomendar
          </button>
        )}
      </div>
      {h.is_recommended && (
        <div className="a-lg-banner">
          <div className="lg-reco-card a-lg-preview">
            {(h.banner_url || h.photos[0]) && <img src={h.banner_url || h.photos[0]} alt="" className="lg-reco-bg" />}
            <span className="lg-badge">Recomendado</span>
            <div className="lg-reco-text">
              <h3>{h.name}</h3>
              {h.tagline && <p>{h.tagline}</p>}
            </div>
          </div>
          <div className="a-lg-banner-actions">
            <button type="button" className="a-btn ghost" disabled={busy || uploading} onClick={() => input.current?.click()}>
              {uploading ? <Loader2 size={16} className="a-spin" aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />} {h.banner_url ? 'Cambiar fondo' : 'Subir fondo'}
            </button>
            {h.banner_url && (
              <button type="button" className="a-btn danger-ghost" disabled={busy} onClick={() => onUpdate(h, true, '', `Se quitó el fondo de ${h.name}; usará su foto principal.`)}>
                Quitar fondo
              </button>
            )}
            {error && <small className="a-err">{error}</small>}
          </div>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      )}
    </li>
  );
}

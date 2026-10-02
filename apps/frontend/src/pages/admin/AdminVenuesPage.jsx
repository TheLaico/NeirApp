import { ImagePlus, Loader2, Star, StarOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadImage } from '../../features/media/api.js';
import { venuesApi } from '../../features/venues/api.js';
import { categoryOf, priceLabel, scheduleLabel } from '../../features/venues/model.js';
import AdminLayout from './AdminLayout.jsx';
import '../lodging/lodging.css';

/**
 * Reservas (admin): los lugares que se reservan (restaurantes, canchas, salones…). Aquí se eligen los destacados (salen
 * primero y en el carrusel de arriba) y el fondo de su banner. Los lugares se autorizan por correo en Roles (rol
 * Establecimiento) y cada uno arma su ficha desde su panel.
 */
export default function AdminVenuesPage({ user, onLogout }) {
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setState({ list: await venuesApi.adminPlaces(), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const update = async (venue, featured, bannerUrl, done) => {
    setBusy(venue.id);
    setError('');
    setNotice('');
    try {
      const saved = await venuesApi.setFeatured(venue.id, featured, bannerUrl);
      setState((s) => ({ ...s, list: s.list.map((r) => (r.venue.id === saved.id ? { ...r, venue: saved } : r)) }));
      setNotice(done);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const featured = state.list.filter((r) => r.venue.is_featured);

  return (
    <AdminLayout user={user} onLogout={onLogout} title="Reservas" subtitle="Lugares que se reservan en Neira. Elige los destacados y el fondo de su banner. Autoriza nuevos lugares en Roles (rol Establecimiento).">
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
        <h2>Lugares {featured.length > 0 && <span className="a-count">{featured.length} destacados</span>}</h2>
        <p className="a-card-hint">Los destacados salen primero en Reservas y en el carrusel de arriba, con la imagen de fondo que subas (horizontal, mínimo 1200 px de ancho). Sin fondo se usa su foto principal.</p>
        {state.loading ? (
          <p className="a-empty">Cargando…</p>
        ) : state.error ? (
          <p className="a-err">{state.error}</p>
        ) : state.list.length === 0 ? (
          <p className="a-empty">Todavía ningún lugar ha creado su ficha.</p>
        ) : (
          <ul className="a-store-list">
            {state.list.map((row) => (
              <VenueAdminRow key={row.venue.id} row={row} busy={busy === row.venue.id} onUpdate={update} />
            ))}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
}

function VenueAdminRow({ row: { venue: v, has_access: hasAccess }, busy, onUpdate }) {
  const input = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const visible = hasAccess && v.is_listed;

  const pick = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadImage(file);
      await onUpdate(v, true, url, `✓ Nuevo fondo para el banner de ${v.name}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <li className="a-store a-cert">
      <div className="a-store-row">
        {v.photos[0] && <img className="a-mq-photo" src={v.photos[0]} alt="" />}
        <div className="a-store-info">
          <strong>{v.name}</strong>
          <span>
            {categoryOf(v.category).one} · {priceLabel(v)} · {scheduleLabel(v)} · {v.reviews_count ? `${v.rating.toLocaleString('es-CO')} ★ (${v.reviews_count})` : 'sin reseñas'}
            {!v.is_listed && ' · oculto por el lugar'}
            {!hasAccess && ' · la cuenta no tiene el rol Establecimiento (autorízala en Roles)'}
          </span>
        </div>
        <span className={`a-badge ${visible ? 'plan-pro' : 'plan-none'}`}>{visible ? 'Visible' : 'No aparece'}</span>
        {v.is_featured ? (
          <button type="button" className="a-btn danger-ghost" disabled={busy} onClick={() => onUpdate(v, false, v.banner_url, `${v.name} ya no es destacado.`)}>
            {busy ? <Loader2 size={16} className="a-spin" aria-hidden="true" /> : <StarOff size={16} aria-hidden="true" />} Quitar destacado
          </button>
        ) : (
          <button type="button" className="a-btn primary" disabled={busy} onClick={() => onUpdate(v, true, v.banner_url, `✓ ${v.name} ahora es destacado.`)}>
            {busy ? <Loader2 size={16} className="a-spin" aria-hidden="true" /> : <Star size={16} aria-hidden="true" />} Destacar
          </button>
        )}
      </div>
      {v.is_featured && (
        <div className="a-lg-banner">
          <div className="lg-reco-card a-lg-preview">
            {(v.banner_url || v.photos[0]) && <img src={v.banner_url || v.photos[0]} alt="" className="lg-reco-bg" />}
            <span className="lg-badge">Destacado</span>
            <div className="lg-reco-text">
              <h3>{v.name}</h3>
              {v.tagline && <p>{v.tagline}</p>}
            </div>
          </div>
          <div className="a-lg-banner-actions">
            <button type="button" className="a-btn ghost" disabled={busy || uploading} onClick={() => input.current?.click()}>
              {uploading ? <Loader2 size={16} className="a-spin" aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />} {v.banner_url ? 'Cambiar fondo' : 'Subir fondo'}
            </button>
            {v.banner_url && (
              <button type="button" className="a-btn danger-ghost" disabled={busy} onClick={() => onUpdate(v, true, '', `Se quitó el fondo de ${v.name}; usará su foto principal.`)}>
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

import { CheckCircle2, Gift, ImagePlus, Loader2, MessageCircle, Sparkles, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { lodgingApi } from '../../features/lodging/api.js';
import { PLANS, dayLabel, isActive, kindOf, whatsappLink } from '../../features/lodging/model.js';
import { uploadImage } from '../../features/media/api.js';
import { formatCop } from '../../lib/money.js';
import AdminLayout from './AdminLayout.jsx';
import '../lodging/lodging.css';

const when = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Hospedaje (admin): confirmar los pagos de los planes de los hoteles (aparecer, $ 25.000 al mes; destacado,
 * $ 4.900 al mes), activar o quitar meses y elegir el fondo del banner de los destacados (salen en "Hoteles
 * recomendados"). Los hoteles se autorizan por correo en Roles (rol Hotel).
 */
export default function AdminLodgingPage({ user, onLogout }) {
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState('');
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
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const run = async (key, action, done) => {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(done);
      setRejecting(null);
      setNote('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const pending = state.list.flatMap(({ hotel, billing }) => ['listing', 'featured'].map((k) => billing[k].pending && { hotel, billing, payment: billing[k].pending }).filter(Boolean));
  pending.sort((a, b) => a.payment.requested_at.localeCompare(b.payment.requested_at));

  return (
    <AdminLayout
      user={user}
      onLogout={onLogout}
      title="Hospedaje"
      subtitle={`Confirma los pagos de los hoteles: ${formatCop(PLANS.listing.fee)} al mes para aparecer y ${formatCop(PLANS.featured.fee)} al mes para salir destacado. Autoriza nuevos hoteles en Roles (rol Hotel).`}
    >
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
        <h2>Pagos por confirmar {pending.length > 0 && <span className="a-count">{pending.length}</span>}</h2>
        <p className="a-card-hint">Al confirmar, el plan corre 30 días (si aún tenía tiempo, se suma al final).</p>
        {state.loading ? (
          <p className="a-empty">Cargando…</p>
        ) : state.error ? (
          <p className="a-err">{state.error}</p>
        ) : pending.length === 0 ? (
          <p className="a-empty">No hay pagos por confirmar.</p>
        ) : (
          <ul className="a-store-list">
            {pending.map(({ hotel: h, billing, payment: p }) => (
              <li key={p.id} className="a-store a-cert">
                <div className="a-store-row">
                  {h.photos[0] && <img className="a-mq-photo" src={h.photos[0]} alt="" />}
                  <div className="a-store-info">
                    <strong>
                      {h.name} · {PLANS[p.kind].label} · {formatCop(p.amount_cop)}
                    </strong>
                    <span>
                      {p.reference ? `Comprobante: ${p.reference}` : 'Sin comprobante'} · enviado el {when(p.requested_at)}
                      {isActive(billing[p.kind].until) && ` · activo hasta el ${dayLabel(billing[p.kind].until)}`}
                    </span>
                  </div>
                  {(h.whatsapp || h.phone) && (
                    <a className="a-btn ghost" href={h.whatsapp ? whatsappLink(h.whatsapp, h.name) : `tel:${h.phone}`} target="_blank" rel="noreferrer">
                      <MessageCircle size={16} aria-hidden="true" /> Contactar
                    </a>
                  )}
                  <button type="button" className="a-btn primary" disabled={busy === p.id} onClick={() => run(p.id, () => lodgingApi.approvePayment(p.id), `✓ ${h.name}: ${PLANS[p.kind].label.toLowerCase()} por 30 días.`)}>
                    {busy === p.id && rejecting !== p.id ? <Loader2 size={16} className="a-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                    Confirmar pago
                  </button>
                  <button
                    type="button"
                    className="a-btn danger-ghost"
                    disabled={busy === p.id}
                    onClick={() => {
                      setRejecting(rejecting === p.id ? null : p.id);
                      setNote('');
                    }}
                  >
                    <XCircle size={16} aria-hidden="true" /> Rechazar
                  </button>
                </div>
                {rejecting === p.id && (
                  <form
                    className="a-reject"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(p.id, () => lodgingApi.rejectPayment(p.id, note), `Se rechazó el pago de ${h.name}.`);
                    }}
                  >
                    <label htmlFor={`lg-rej-${p.id}`}>Motivo (lo verá el hotel)</label>
                    <input id={`lg-rej-${p.id}`} value={note} maxLength={200} placeholder="Ej: No encontramos el pago con ese comprobante" onChange={(e) => setNote(e.target.value)} autoFocus />
                    <button type="submit" className="a-btn danger" disabled={busy === p.id || note.trim().length < 5}>
                      Enviar rechazo
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="a-card">
        <h2>Hoteles</h2>
        <p className="a-card-hint">
          Aparecen en Hospedaje los que tienen el plan al día, no se ocultaron y su cuenta tiene el rol Hotel. Los destacados salen primero y en “Hoteles recomendados”, con el fondo que subas aquí
          (horizontal, mínimo 1200 px de ancho; sin fondo se usa su foto principal).
        </p>
        {!state.loading && !state.error && state.list.length === 0 && <p className="a-empty">Todavía ningún hotel ha creado su ficha.</p>}
        {state.list.length > 0 && (
          <ul className="a-store-list">
            {state.list.map((row) => (
              <HotelAdminRow key={row.hotel.id} row={row} busy={busy} run={run} />
            ))}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
}

function HotelAdminRow({ row: { hotel: h, billing, has_access: hasAccess }, busy, run }) {
  const input = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const listed = isActive(billing.listing.until);
  const featured = isActive(billing.featured.until);
  const visible = hasAccess && h.is_listed && listed;

  const pick = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadImage(file);
      await run(`b-${h.id}`, () => lodgingApi.setBanner(h.id, url), `✓ Nuevo fondo para el banner de ${h.name}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const planLine = (kind) => {
    const until = billing[kind].until;
    if (isActive(until)) return `hasta el ${dayLabel(until)}`;
    return until ? `venció el ${dayLabel(until)}` : 'no';
  };

  return (
    <li className="a-store a-cert">
      <div className="a-store-row">
        {h.photos[0] && <img className="a-mq-photo" src={h.photos[0]} alt="" />}
        <div className="a-store-info">
          <strong>{h.name}</strong>
          <span>
            {kindOf(h.kind).label} · Aparece: {planLine('listing')} · Destacado: {planLine('featured')}
            {!h.is_listed && ' · oculto por el hotel'}
            {!hasAccess && ' · la cuenta no tiene el rol Hotel (autorízala en Roles)'}
          </span>
        </div>
        <span className={`a-badge ${visible ? 'plan-pro' : 'plan-none'}`}>{visible ? (featured ? 'Destacado' : 'Visible') : 'No aparece'}</span>
      </div>
      <div className="a-lg-actions">
        {['listing', 'featured'].map((kind) => {
          const key = `${kind}-${h.id}`;
          const on = kind === 'listing' ? listed : featured;
          return (
            <span key={kind} className="a-lg-plan">
              <button type="button" className="a-btn ghost" disabled={busy === key} onClick={() => run(key, () => lodgingApi.grantMonth(h.id, kind), `✓ ${h.name}: se activó un mes (${PLANS[kind].label.toLowerCase()}).`)}>
                {busy === key ? <Loader2 size={16} className="a-spin" aria-hidden="true" /> : kind === 'listing' ? <Gift size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
                {kind === 'listing' ? 'Activar un mes' : 'Destacar un mes'}
              </button>
              {on && (
                <button
                  type="button"
                  className="a-btn danger-ghost"
                  disabled={busy === key}
                  onClick={() => window.confirm(`¿Quitar "${PLANS[kind].label}" a ${h.name} desde hoy?`) && run(key, () => lodgingApi.endPlan(h.id, kind), `Se quitó "${PLANS[kind].label}" a ${h.name}.`)}
                >
                  {kind === 'listing' ? 'Quitar plan' : 'Quitar destacado'}
                </button>
              )}
            </span>
          );
        })}
      </div>
      {featured && (
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
            <button type="button" className="a-btn ghost" disabled={busy === `b-${h.id}` || uploading} onClick={() => input.current?.click()}>
              {uploading ? <Loader2 size={16} className="a-spin" aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />} {h.banner_url ? 'Cambiar fondo' : 'Subir fondo'}
            </button>
            {h.banner_url && (
              <button type="button" className="a-btn danger-ghost" disabled={busy === `b-${h.id}`} onClick={() => run(`b-${h.id}`, () => lodgingApi.setBanner(h.id, ''), `Se quitó el fondo de ${h.name}; usará su foto principal.`)}>
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

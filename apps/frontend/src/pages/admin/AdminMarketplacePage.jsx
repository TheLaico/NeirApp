import { CheckCircle2, ExternalLink, Flag, Loader2, MessageCircle, ShieldOff, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { marketplaceApi } from '../../features/marketplace/api.js';
import { KINDS, priceLabel, reasonLabel } from '../../features/marketplace/model.js';
import { formatCop } from '../../lib/money.js';
import AdminLayout from './AdminLayout.jsx';

const when = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * MarquetNeira (admin): confirmar los pagos de publicación ($ 10.000 al mes por inmueble) y revisar las publicaciones
 * reportadas — descartar los reportes si está bien, o retirarla contándole el motivo al vendedor.
 */
export default function AdminMarketplacePage({ user, onLogout }) {
  const [payments, setPayments] = useState({ list: [], loading: true, error: '' });
  const [reports, setReports] = useState({ list: [], loading: true, error: '' });
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null); // id del pago o de la publicación
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const [p, r] = await Promise.allSettled([marketplaceApi.pendingPayments(), marketplaceApi.reports()]);
    setPayments(p.status === 'fulfilled' ? { list: p.value, loading: false, error: '' } : { list: [], loading: false, error: p.reason.message });
    setReports(r.status === 'fulfilled' ? { list: r.value, loading: false, error: '' } : { list: [], loading: false, error: r.reason.message });
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

  const toggleNote = (key) => {
    setRejecting(rejecting === key ? null : key);
    setNote('');
  };

  return (
    <AdminLayout user={user} onLogout={onLogout} title="MarquetNeira" subtitle="Confirma los pagos de las publicaciones de inmuebles y revisa las que reportaron los clientes.">
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
        <h2>Pagos por confirmar {payments.list.length > 0 && <span className="a-count">{payments.list.length}</span>}</h2>
        <p className="a-card-hint">Cada publicación cuesta {formatCop(10000)} al mes. Al confirmar, el inmueble se ve 30 días en MarquetNeira.</p>
        {payments.loading ? (
          <p className="a-empty">Cargando…</p>
        ) : payments.error ? (
          <p className="a-err">{payments.error}</p>
        ) : payments.list.length === 0 ? (
          <p className="a-empty">No hay pagos por confirmar.</p>
        ) : (
          <ul className="a-store-list">
            {payments.list.map((p) => (
              <li key={p.id} className="a-store a-cert">
                <div className="a-store-row">
                  <div className="a-store-info">
                    <strong>
                      {p.listing_title} · {formatCop(p.amount_cop)}
                    </strong>
                    <span>
                      {p.seller_name || 'Vendedor'} · {p.reference ? `Comprobante: ${p.reference}` : 'Sin comprobante'} · enviado el {when(p.requested_at)}
                    </span>
                  </div>
                  <a className="a-btn ghost" href={`/marquetneira/producto?id=${p.listing_id}`} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} aria-hidden="true" /> Ver
                  </a>
                  <a className="a-btn ghost" href={`https://wa.me/57${p.seller_whatsapp}`} target="_blank" rel="noreferrer">
                    <MessageCircle size={16} aria-hidden="true" /> WhatsApp
                  </a>
                  <button type="button" className="a-btn primary" disabled={busy === p.id} onClick={() => run(p.id, () => marketplaceApi.approvePayment(p.id), `✓ “${p.listing_title}” quedó publicada por 30 días.`)}>
                    {busy === p.id && rejecting !== p.id ? <Loader2 size={16} className="a-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                    Confirmar pago
                  </button>
                  <button type="button" className="a-btn danger-ghost" disabled={busy === p.id} onClick={() => toggleNote(p.id)}>
                    <XCircle size={16} aria-hidden="true" /> Rechazar
                  </button>
                </div>
                {rejecting === p.id && (
                  <form
                    className="a-reject"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(p.id, () => marketplaceApi.rejectPayment(p.id, note), 'Se rechazó el pago y le avisamos al vendedor.');
                    }}
                  >
                    <label htmlFor={`mq-pay-${p.id}`}>Motivo (lo verá el vendedor)</label>
                    <input id={`mq-pay-${p.id}`} value={note} maxLength={200} placeholder="Ej: No encontramos el pago con ese comprobante" onChange={(e) => setNote(e.target.value)} autoFocus />
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
        <h2>Publicaciones reportadas {reports.list.length > 0 && <span className="a-count">{reports.list.length}</span>}</h2>
        <p className="a-card-hint">Revisa cada publicación. Si está bien, descarta los reportes; si no, retírala y explícale el motivo al vendedor.</p>
        {reports.loading ? (
          <p className="a-empty">Cargando…</p>
        ) : reports.error ? (
          <p className="a-err">{reports.error}</p>
        ) : reports.list.length === 0 ? (
          <p className="a-empty">No hay publicaciones reportadas. 🎉</p>
        ) : (
          <ul className="a-store-list">
            {reports.list.map(({ listing, reports: items }) => {
              const key = `r-${listing.id}`;
              return (
                <li key={listing.id} className="a-store a-cert a-mq-report">
                  <div className="a-store-row">
                    <img className="a-mq-photo" src={listing.photos[0]} alt="" />
                    <div className="a-store-info">
                      <strong>
                        {listing.title} · {KINDS[listing.kind]} · {priceLabel(listing)}
                      </strong>
                      <span>
                        {listing.seller_name || 'Vendedor'} · {items.length === 1 ? '1 reporte' : `${items.length} reportes`}
                      </span>
                    </div>
                    <a className="a-btn ghost" href={`/marquetneira/producto?id=${listing.id}`} target="_blank" rel="noreferrer">
                      <ExternalLink size={16} aria-hidden="true" /> Ver
                    </a>
                    <button type="button" className="a-btn ghost" disabled={busy === key} onClick={() => run(key, () => marketplaceApi.dismissReports(listing.id), `Se descartaron los reportes de “${listing.title}”.`)}>
                      <CheckCircle2 size={16} aria-hidden="true" /> Está bien
                    </button>
                    <button type="button" className="a-btn danger-ghost" disabled={busy === key} onClick={() => toggleNote(key)}>
                      <ShieldOff size={16} aria-hidden="true" /> Retirar
                    </button>
                  </div>
                  <ul className="a-mq-reasons">
                    {items.map((r) => (
                      <li key={r.id}>
                        <Flag size={14} aria-hidden="true" />
                        <span>
                          <b>{reasonLabel(r.reason)}</b>
                          {r.details && ` — “${r.details}”`} <small>· {when(r.created_at)}</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {rejecting === key && (
                    <form
                      className="a-reject"
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(key, () => marketplaceApi.removeListing(listing.id, note), `Retiramos “${listing.title}” y le avisamos al vendedor.`);
                      }}
                    >
                      <label htmlFor={`mq-rm-${listing.id}`}>Motivo (lo verá el vendedor)</label>
                      <input id={`mq-rm-${listing.id}`} value={note} maxLength={200} placeholder="Ej: La publicación no corresponde a un inmueble" onChange={(e) => setNote(e.target.value)} autoFocus />
                      <button type="submit" className="a-btn danger" disabled={busy === key || note.trim().length < 5}>
                        Retirar publicación
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
}

import { CheckCircle2, Loader2, Sparkles, XCircle } from 'lucide-react';
import { useState } from 'react';
import { usePolled } from '../../features/courier/api.js';
import { dayLabel } from '../../features/lodging/model.js';
import { CATEGORY_LABEL } from '../../features/stores/categories.jsx';
import { PROMOTION_DAYS, PROMOTION_FEE_COP, storesApi } from '../../features/stores/api.js';
import { formatCop } from '../../lib/money.js';

const when = (iso) => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Productos destacados: los comerciantes pagan $ 7.000 por fuera y reportan el comprobante. Aquí el administrador
 * confirma (el producto sale 30 días en "Productos recomendados" del inicio), rechaza con un motivo o quita uno activo.
 */
export default function PromotedProductsAdmin() {
  const { data, error, loading, refresh } = usePolled(storesApi.adminPromotions, { every: 30000 });
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const run = async (id, fn, done) => {
    setBusy(id);
    setActionError('');
    setMessage('');
    try {
      await fn();
      await refresh();
      setMessage(done);
      setRejecting(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const all = data ?? [];
  const pending = all.filter((p) => p.status === 'pending');
  const active = all.filter((p) => p.status === 'approved' && (p.is_active || new Date(p.starts_at) > new Date()));
  const label = (p) => `${p.product?.name ?? 'Producto eliminado'} · ${p.store_name ?? 'Tienda'}`;

  return (
    <section className="a-card">
      <h2>
        <Sparkles size={18} aria-hidden="true" /> Productos destacados
      </h2>
      <p className="a-empty">
        Los comerciantes pagan {formatCop(PROMOTION_FEE_COP)} por destacar un producto en “Productos recomendados” del inicio durante {PROMOTION_DAYS} días. Confirma el
        pago cuando lo veas.
      </p>

      {loading && !data && <p className="a-empty">Cargando…</p>}
      {(error || actionError) && (
        <p className="a-err" role="alert">
          {actionError || error}
        </p>
      )}
      {message && (
        <p className="a-success" role="status">
          {message}
        </p>
      )}

      <h3 className="a-label">Pagos por confirmar</h3>
      {data && pending.length === 0 && <p className="a-empty">No hay pagos por confirmar.</p>}
      <ul className="a-store-list">
        {pending.map((p) => (
          <li key={p.id} className="a-store a-cert">
            <div className="a-store-row">
              {p.product?.image_url && <img className="a-mq-photo" src={p.product.image_url} alt="" />}
              <div className="a-store-info">
                <strong>
                  {label(p)} · {formatCop(p.amount_cop)}
                </strong>
                <span>
                  {CATEGORY_LABEL[p.store_category] ?? ''} · {p.reference ? `Comprobante: ${p.reference}` : 'Sin comprobante'} · enviado el {when(p.requested_at)}
                </span>
              </div>
              <button type="button" className="a-btn primary" disabled={busy === p.id} onClick={() => run(p.id, () => storesApi.approvePromotion(p.id), `✓ ${label(p)}: destacado por ${PROMOTION_DAYS} días.`)}>
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
                  run(p.id, () => storesApi.rejectPromotion(p.id, note.trim()), `Se rechazó el pago de ${label(p)}.`);
                }}
              >
                <label htmlFor={`pp-rej-${p.id}`}>Motivo (lo verá el comerciante)</label>
                <input id={`pp-rej-${p.id}`} value={note} maxLength={200} placeholder="Ej: No encontramos el pago con ese comprobante" onChange={(e) => setNote(e.target.value)} autoFocus />
                <button type="submit" className="a-btn danger" disabled={busy === p.id || note.trim().length < 5}>
                  Enviar rechazo
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      <h3 className="a-label">Destacados ahora</h3>
      {data && active.length === 0 && <p className="a-empty">Ningún producto está destacado.</p>}
      <ul className="a-store-list">
        {active.map((p) => (
          <li key={p.id} className="a-store-row a-grant">
            <div className="a-store-info">
              <strong>{label(p)}</strong>
              <span>
                {CATEGORY_LABEL[p.store_category] ?? ''} · {p.is_active ? `hasta el ${dayLabel(p.expires_at)}` : `del ${dayLabel(p.starts_at)} al ${dayLabel(p.expires_at)}`}
              </span>
            </div>
            <button
              type="button"
              className="a-btn ghost"
              disabled={busy === p.id}
              onClick={() => window.confirm(`¿Dejar de destacar “${p.product?.name ?? 'este producto'}” desde ya?`) && run(p.id, () => storesApi.endPromotion(p.id), `Se quitó ${label(p)} de los recomendados.`)}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

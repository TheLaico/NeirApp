import { CheckCircle2, Hourglass, Loader2, Receipt, Sparkles, XCircle } from 'lucide-react';
import { useState } from 'react';
import { usePolled } from '../../features/courier/api.js';
import { dayLabel } from '../../features/lodging/model.js';
import { CATEGORY_LABEL } from '../../features/stores/categories.jsx';
import { PROMOTION_DAYS, PROMOTION_FEE_COP, storesApi } from '../../features/stores/api.js';
import { formatCop } from '../../lib/money.js';
import { PAYMENT } from '../professional/plans.js';
import './promote.css';

/** En qué va un pago para destacar: en revisión, activo, programado (empieza al terminar otro), vencido… */
function statusOf(p) {
  if (p.status === 'pending') return { tone: 'wait', Icon: Hourglass, text: 'Estamos confirmando tu pago' };
  if (p.status === 'rejected') return { tone: 'bad', Icon: XCircle, text: `No pudimos confirmar el pago: ${p.note.replace(/\.$/, '')}` };
  if (p.status === 'approved') {
    if (p.is_active) return { tone: 'ok', Icon: CheckCircle2, text: `Destacado hasta el ${dayLabel(p.expires_at)}` };
    if (new Date(p.starts_at) > new Date()) return { tone: 'ok', Icon: CheckCircle2, text: `Se destaca del ${dayLabel(p.starts_at)} al ${dayLabel(p.expires_at)}` };
    return { tone: 'muted', Icon: CheckCircle2, text: `Estuvo destacado hasta el ${dayLabel(p.expires_at)}` };
  }
  return null; // cancelado: no se muestra
}

/**
 * "Destacar productos": el comerciante elige un producto, paga $ 7.000 por fuera y reporta el comprobante. Cuando el
 * administrador lo confirma, el producto sale 30 días en "Productos recomendados" del inicio, en la categoría de su tienda.
 * Solo se pueden destacar productos disponibles: los que los clientes pueden agregar al carrito.
 */
export default function PromoteView({ store }) {
  const products = usePolled(() => storesApi.products(store.id));
  const promotions = usePolled(() => storesApi.promotions(store.id), { every: 30000 });
  const [productId, setProductId] = useState('');
  const [reference, setReference] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');

  const available = (products.data ?? []).filter((p) => p.is_available);
  const pendingFor = new Set((promotions.data ?? []).filter((p) => p.status === 'pending').map((p) => p.product_id));
  const shown = (promotions.data ?? []).map((p) => ({ p, s: statusOf(p) })).filter(({ s }) => s);

  const submit = async (e) => {
    e.preventDefault();
    if (!productId) return setError('Elige el producto que quieres destacar.');
    setError('');
    setSent('');
    setSending(true);
    try {
      const promo = await storesApi.requestPromotion(store.id, productId, reference.trim());
      setSent(promo.product?.name ?? '');
      setProductId('');
      setReference('');
      await promotions.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const cancel = async (id) => {
    if (!window.confirm('¿Cancelar el pago en revisión?')) return;
    setError('');
    try {
      await storesApi.cancelPromotion(store.id, id);
      await promotions.refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <form className="cr-card cr-form" onSubmit={submit} noValidate>
        <h2>
          <Sparkles size={18} aria-hidden="true" /> Destaca un producto
        </h2>
        <p className="cr-muted">
          Por <strong>{formatCop(PROMOTION_FEE_COP)}</strong> tu producto sale {PROMOTION_DAYS} días en “Productos recomendados” del inicio de NeirAPP, en la
          categoría {CATEGORY_LABEL[store.category] ?? 'de tu tienda'}. Solo se pueden destacar productos disponibles, de los que los clientes pueden agregar
          al carrito.
        </p>

        <label>
          1. Elige el producto
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">{available.length ? 'Elige un producto…' : 'No tienes productos disponibles'}</option>
            {available.map((p) => (
              <option key={p.id} value={p.id} disabled={pendingFor.has(p.id)}>
                {p.name} · {formatCop(p.price_cop)}
                {pendingFor.has(p.id) ? ' (pago en revisión)' : ''}
              </option>
            ))}
          </select>
        </label>

        <div>
          <strong className="pm-step">2. Paga {formatCop(PROMOTION_FEE_COP)}</strong>
          {PAYMENT.methods.length > 0 ? (
            <ul className="pm-methods">
              {PAYMENT.methods.map((m) => (
                <li key={m.label}>
                  <span>{m.label}</span>
                  <strong>{m.value}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cr-muted">Envía la solicitud y el equipo de NeirAPP te escribirá por WhatsApp con los datos para pagar.</p>
          )}
        </div>

        <label>
          3. Número de comprobante (opcional)
          <input value={reference} maxLength={120} placeholder="Ej: Nequi M1234567" onChange={(e) => setReference(e.target.value)} />
        </label>

        {error && (
          <p className="cr-error" role="alert">
            {error}
          </p>
        )}
        {sent !== '' && (
          <p className="cr-ok" role="status">
            <CheckCircle2 size={16} aria-hidden="true" /> Recibimos tu pago{sent ? ` para “${sent}”` : ''}. Cuando lo confirmemos, saldrá en Productos
            recomendados.
          </p>
        )}
        <button type="submit" className="cr-btn primary" disabled={sending || !available.length}>
          {sending ? <Loader2 size={18} className="cr-spin" aria-hidden="true" /> : <Receipt size={18} aria-hidden="true" />}
          Enviar pago de {formatCop(PROMOTION_FEE_COP)}
        </button>
      </form>

      <section className="cr-card">
        <h2>Tus productos destacados</h2>
        {promotions.loading && !promotions.data && <p className="cr-empty">Cargando…</p>}
        {promotions.data && shown.length === 0 && <p className="cr-muted">Aquí verás los productos que destaques y hasta cuándo salen.</p>}
        <ul className="cr-list">
          {shown.map(({ p, s }) => (
            <li key={p.id} className="pm-item">
              {p.product?.image_url ? <img className="cr-thumb" src={p.product.image_url} alt="" loading="lazy" /> : <span className="cr-thumb" aria-hidden="true" />}
              <div>
                <strong>{p.product?.name ?? 'Producto eliminado'}</strong>
                <span className={`pm-status ${s.tone}`}>
                  <s.Icon size={15} aria-hidden="true" /> {s.text}
                </span>
                <small className="cr-muted">
                  {formatCop(p.amount_cop)}
                  {p.reference ? ` · ${p.reference}` : ''}
                </small>
              </div>
              {p.status === 'pending' && (
                <button type="button" className="cr-btn ghost sm pm-cancel" onClick={() => cancel(p.id)}>
                  Cancelar
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

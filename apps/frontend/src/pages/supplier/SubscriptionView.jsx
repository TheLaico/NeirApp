import { AlertTriangle, Check, CheckCircle2, Hourglass, Loader2, Receipt, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SUBSCRIPTION_DAYS, SUBSCRIPTION_FEE, dayLabel, isPaid } from '../../features/suppliers/model.js';
import { formatCop } from '../../lib/money.js';
import { PAYMENT } from '../professional/plans.js';

const BENEFITS = [
  'Tu empresa aparece en Proveedores de NeirAPP',
  'Tu catálogo (brochure) visible con “Ver catálogo”',
  'Botones de llamada, WhatsApp, Facebook e Instagram',
  'Sin comisiones: los pedidos los cuadras directamente',
];

/**
 * "Suscripción": $ 24.900 al mes para aparecer en Proveedores y publicar el catálogo. La empresa paga por fuera,
 * reporta el comprobante y el administrador lo confirma; renovar suma el mes al final del que ya tiene pagado.
 */
export default function SubscriptionView({ supplier, subscription, onPay, onCancel, onGo }) {
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const paid = isPaid(subscription?.paid_until);
  const pending = subscription?.pending;
  const rejected = subscription?.rejected;

  const cancel = async () => {
    if (!window.confirm('¿Cancelar el pago en revisión?')) return;
    setBusy(true);
    setError('');
    try {
      await onCancel(pending.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="spp-view">
      <div className="spp-head">
        <h1>Suscripción</h1>
        <p>Con la suscripción tu empresa aparece en Proveedores y publica su catálogo. NeirAPP no cobra comisión por tus ventas.</p>
      </div>

      {paid ? (
        <p className="spp-banner ok">
          <CheckCircle2 size={18} aria-hidden="true" /> Tu suscripción está activa hasta el <b>{dayLabel(subscription.paid_until)}</b>.
          {!supplier?.is_listed && ' Ojo: ocultaste tu empresa en Mi empresa, así que nadie la ve.'}
        </p>
      ) : (
        !pending && (
          <p className="spp-banner warn">
            <AlertTriangle size={18} aria-hidden="true" /> {subscription?.paid_until ? `Tu suscripción venció el ${dayLabel(subscription.paid_until)}.` : 'Todavía no tienes una suscripción activa.'} Tu
            empresa no aparece en Proveedores.
          </p>
        )
      )}
      {pending && (
        <div className="spp-banner wait">
          <Hourglass size={18} aria-hidden="true" />
          <span>
            Estamos confirmando tu pago{pending.reference ? ` (comprobante ${pending.reference})` : ''}. Te avisaremos apenas quede activo.
          </span>
          <button type="button" className="spp-link" disabled={busy} onClick={cancel}>
            Cancelar
          </button>
        </div>
      )}
      {rejected && !pending && (
        <p className="spp-banner bad">
          <XCircle size={18} aria-hidden="true" /> No pudimos confirmar tu último pago: {rejected.note.replace(/\.$/, '')}.
        </p>
      )}
      {error && <p className="spp-banner bad">{error}</p>}

      <div className="spp-sub">
        <section className="spp-plan">
          <span className="spp-plan-tag">Proveedor</span>
          <p className="spp-plan-price">
            <strong>{formatCop(SUBSCRIPTION_FEE)}</strong> <span>al mes</span>
          </p>
          <ul>
            {BENEFITS.map((b) => (
              <li key={b}>
                <Check size={17} aria-hidden="true" /> {b}
              </li>
            ))}
          </ul>
          {!supplier ? (
            <button type="button" className="sp-btn primary" onClick={() => onGo('company')}>
              Primero crea tu empresa
            </button>
          ) : (
            <button type="button" className="sp-btn primary" disabled={Boolean(pending)} onClick={() => setPaying(true)}>
              <Receipt size={16} aria-hidden="true" /> {pending ? 'Pago en revisión' : paid ? 'Renovar un mes' : `Pagar ${formatCop(SUBSCRIPTION_FEE)}`}
            </button>
          )}
        </section>

        <section className="spp-history">
          <h2>Historial</h2>
          {subscription?.history?.length ? (
            <ul>
              {subscription.history.map((p) => (
                <li key={p.id}>
                  <CheckCircle2 size={17} aria-hidden="true" />
                  <span>
                    <strong>
                      {dayLabel(p.starts_at)} – {dayLabel(p.expires_at)}
                    </strong>
                    <small>
                      {formatCop(p.amount_cop)}
                      {p.reference ? ` · ${p.reference}` : ''}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sp-muted">Aquí verás los meses que has pagado.</p>
          )}
        </section>
      </div>

      {paying && <PayDialog renewing={paid} onSend={onPay} onClose={() => setPaying(false)} />}
    </div>
  );
}

function PayDialog({ renewing, onSend, onClose }) {
  const [reference, setReference] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await onSend(reference.trim());
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="sp-scrim" onClick={onClose}>
      <div className="sp-dialog" role="dialog" aria-modal="true" aria-labelledby="spp-pay-title" onClick={(e) => e.stopPropagation()}>
        <div className="sp-dialog-head">
          <div>
            <h2 id="spp-pay-title">{sent ? '¡Recibimos tu pago!' : renewing ? 'Renovar suscripción' : 'Activar suscripción'}</h2>
          </div>
          <button type="button" className="sp-close" aria-label="Cerrar" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {sent ? (
          <div className="spp-done">
            <CheckCircle2 size={50} aria-hidden="true" />
            <p>Estamos confirmando tu pago. Cuando quede listo te avisamos en Notificaciones y tu empresa aparecerá {SUBSCRIPTION_DAYS} días en Proveedores.</p>
            <button type="button" className="sp-btn primary" onClick={onClose}>
              Entendido
            </button>
          </div>
        ) : (
          <form className="spp-pay" onSubmit={submit} noValidate>
            <p className="spp-total">
              <span>Total a pagar</span>
              <strong>{formatCop(SUBSCRIPTION_FEE)}</strong>
              <small>por {SUBSCRIPTION_DAYS} días</small>
            </p>
            {renewing && <p className="sp-muted">El mes nuevo empieza cuando termine el que ya tienes pagado: no pierdes días.</p>}
            <h3>1. Paga</h3>
            {PAYMENT.methods.length > 0 ? (
              <ul className="spp-methods">
                {PAYMENT.methods.map((m) => (
                  <li key={m.label}>
                    <span>{m.label}</span>
                    <strong>{m.value}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sp-muted">Envía la solicitud y el equipo de NeirAPP te escribirá por WhatsApp con los datos para pagar.</p>
            )}
            <h3>2. Cuéntanos cómo pagaste</h3>
            <label className="sp-field">
              <span>
                Número de comprobante <span className="sp-optional">(opcional)</span>
              </span>
              <input value={reference} maxLength={120} placeholder="Ej: Nequi M1234567" onChange={(e) => setReference(e.target.value)} autoFocus />
            </label>
            {error && (
              <p className="sp-error" role="alert">
                {error}
              </p>
            )}
            <div className="sp-form-actions">
              <button type="button" className="sp-btn outline" onClick={onClose}>
                Después
              </button>
              <button type="submit" className="sp-btn primary" disabled={sending}>
                {sending && <Loader2 size={16} className="sp-spin" aria-hidden="true" />} Enviar pago
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

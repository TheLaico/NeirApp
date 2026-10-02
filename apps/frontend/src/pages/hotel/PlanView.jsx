import { AlertTriangle, Check, CheckCircle2, Hourglass, Loader2, Receipt, Sparkles, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PLANS, PLAN_DAYS, dayLabel, isActive } from '../../features/lodging/model.js';
import { formatCop } from '../../lib/money.js';
import { PAYMENT } from '../professional/plans.js';

const BENEFITS = {
  listing: [
    'Tu hotel aparece en Hospedaje, en la lista y en el mapa',
    'Recibe solicitudes de reserva y reseñas',
    'Botones de WhatsApp, llamada y “Cómo llegar”',
    'Sin comisiones por tus reservas',
  ],
  featured: [
    'Sale en el carrusel “Hoteles recomendados” con un banner grande',
    'Aparece primero en la lista con la etiqueta Recomendado',
    'Requiere tener activo el plan para aparecer',
  ],
};

/**
 * "Plan": $ 25.000 al mes para aparecer en Hospedaje y $ 4.900 al mes para destacarse. El hotel paga por fuera,
 * reporta el comprobante y el administrador lo confirma; renovar suma el mes al final del que ya tiene pagado.
 */
export default function PlanView({ hotel, billing, onPay, onCancel, onGo }) {
  const [paying, setPaying] = useState(null);
  const [error, setError] = useState('');
  const listingOn = isActive(billing?.listing.until);

  return (
    <div className="spp-view">
      <div className="spp-head">
        <h1>Plan</h1>
        <p>Para que tu hotel aparezca en Hospedaje se paga un plan mensual. Con el plan Destacado sale en “Hoteles recomendados”. NeirAPP no cobra comisión por tus reservas.</p>
      </div>
      {!hotel && (
        <button type="button" className="spp-banner warn" onClick={() => onGo('hotel')}>
          <AlertTriangle size={18} aria-hidden="true" />
          <span>Primero crea la ficha de tu hotel en Mi hotel.</span>
        </button>
      )}
      {error && <p className="spp-banner bad">{error}</p>}

      <div className="htp-plans">
        {['listing', 'featured'].map((kind) => (
          <PlanCard
            key={kind}
            kind={kind}
            plan={billing?.[kind]}
            hotel={hotel}
            blocked={kind === 'featured' && !listingOn && !billing?.listing.pending}
            onPay={() => setPaying(kind)}
            onCancel={async (id) => {
              if (!window.confirm('¿Cancelar el pago en revisión?')) return;
              setError('');
              try {
                await onCancel(id);
              } catch (err) {
                setError(err.message);
              }
            }}
          />
        ))}
      </div>

      <section className="spp-history">
        <h2>Historial</h2>
        {billing?.history?.length ? (
          <ul>
            {billing.history.map((p) => (
              <li key={p.id}>
                <CheckCircle2 size={17} aria-hidden="true" />
                <span>
                  <strong>
                    {PLANS[p.kind].short}: {dayLabel(p.starts_at)} – {dayLabel(p.expires_at)}
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

      {paying && <PayDialog kind={paying} renewing={isActive(billing?.[paying].until)} onSend={(reference) => onPay(paying, reference)} onClose={() => setPaying(null)} />}
    </div>
  );
}

function PlanCard({ kind, plan, hotel, blocked, onPay, onCancel }) {
  const { fee, label } = PLANS[kind];
  const active = isActive(plan?.until);
  const pending = plan?.pending;
  const rejected = plan?.rejected;
  return (
    <section className={`spp-plan htp-plan ${kind}`}>
      <span className="spp-plan-tag">
        {kind === 'featured' && <Sparkles size={13} aria-hidden="true" />} {label}
      </span>
      <p className="spp-plan-price">
        <strong>{formatCop(fee)}</strong> <span>al mes</span>
      </p>
      <ul>
        {BENEFITS[kind].map((b) => (
          <li key={b}>
            <Check size={17} aria-hidden="true" /> {b}
          </li>
        ))}
      </ul>
      {active ? (
        <p className="spp-banner ok">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>
            Activo hasta el <b>{dayLabel(plan.until)}</b>.
          </span>
        </p>
      ) : (
        !pending && (
          <p className="spp-banner warn">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>{plan?.until ? `Venció el ${dayLabel(plan.until)}.` : 'No lo tienes activo.'}</span>
          </p>
        )
      )}
      {pending && (
        <div className="spp-banner wait">
          <Hourglass size={18} aria-hidden="true" />
          <span>Estamos confirmando tu pago{pending.reference ? ` (${pending.reference})` : ''}.</span>
          <button type="button" className="spp-link" onClick={() => onCancel(pending.id)}>
            Cancelar
          </button>
        </div>
      )}
      {rejected && !pending && (
        <p className="spp-banner bad">
          <XCircle size={18} aria-hidden="true" />
          <span>No pudimos confirmar tu último pago: {rejected.note.replace(/\.$/, '')}.</span>
        </p>
      )}
      {blocked && <p className="sp-muted">Para destacarte, primero activa el plan para aparecer en Hospedaje.</p>}
      <button type="button" className="sp-btn primary" disabled={!hotel || Boolean(pending) || blocked} onClick={onPay}>
        <Receipt size={16} aria-hidden="true" /> {pending ? 'Pago en revisión' : active ? 'Renovar un mes' : `Pagar ${formatCop(fee)}`}
      </button>
    </section>
  );
}

function PayDialog({ kind, renewing, onSend, onClose }) {
  const { fee, label } = PLANS[kind];
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
      <div className="sp-dialog" role="dialog" aria-modal="true" aria-labelledby="htp-pay-title" onClick={(e) => e.stopPropagation()}>
        <div className="sp-dialog-head">
          <div>
            <h2 id="htp-pay-title">{sent ? '¡Recibimos tu pago!' : `${renewing ? 'Renovar' : 'Activar'}: ${label}`}</h2>
          </div>
          <button type="button" className="sp-close" aria-label="Cerrar" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {sent ? (
          <div className="spp-done">
            <CheckCircle2 size={50} aria-hidden="true" />
            <p>
              Estamos confirmando tu pago. Cuando quede listo te avisamos en Notificaciones y {kind === 'featured' ? 'tu hotel saldrá en Hoteles recomendados' : 'tu hotel aparecerá en Hospedaje'} por{' '}
              {PLAN_DAYS} días.
            </p>
            <button type="button" className="sp-btn primary" onClick={onClose}>
              Entendido
            </button>
          </div>
        ) : (
          <form className="spp-pay" onSubmit={submit} noValidate>
            <p className="spp-total">
              <span>Total a pagar</span>
              <strong>{formatCop(fee)}</strong>
              <small>por {PLAN_DAYS} días</small>
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

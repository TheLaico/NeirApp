import { AlertTriangle, ArrowLeft, BriefcaseBusiness, Check, CheckCircle2, Clock, Crown, Hourglass, Loader2, Sparkles, Sprout, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import logo from '../../assets/logo-neirapp.png';
import { Leaf } from '../../components/common/Leaf.jsx';
import { PLAN_NAMES, dayLabel, daysLeft, paidUntil, useMyPlan } from '../../features/professionals/subscription.js';
import { formatCop } from '../../lib/money.js';
import { useNavigate } from '../../lib/router.jsx';
import { AVAILABLE_PLANS, PAYMENT, PLAN_DAYS } from './plans.js';
import './plans-page.css';

const PLAN_ICONS = { Sprout, BriefcaseBusiness, Crown };

// Hojas de cada tarjeta, en la esquina de su encabezado (se mecen al pasar el cursor).
const CARD_LEAVES = {
  basic: ['#8cc56b', '#2d7a3d'],
  pro: ['#5a9a4a', '#8cc56b'],
  premium: ['#a8700c', '#fbe08a'],
  unico: ['#5a9a4a', '#e8a92c'],
};

/**
 * Página "Planes para profesionales": los planes que se ofrecen hoy (`AVAILABLE_PLANS`; por ahora uno solo, de
 * $ 15.000) lado a lado (en celular, uno debajo del otro). El profesional
 * elige uno, paga por fuera y escribe el comprobante; el administrador confirma el pago y el plan queda activo 30 días.
 * Sin plan activo su perfil no aparece en el directorio.
 */
export default function PlansPage({ user }) {
  const navigate = useNavigate();
  const allowed = user?.roles?.includes('professional') || user?.roles?.includes('admin');
  const mine = useMyPlan(allowed);
  const [paying, setPaying] = useState(null); // plan que está pagando (ventana abierta)
  const status = allowed ? mine.status : null;
  const current = status?.current?.plan ?? null;
  const pending = status?.pending ?? null;

  useEffect(() => {
    document.body.classList.add('is-home');
    return () => document.body.classList.remove('is-home');
  }, []);

  return (
    <div className="plans">
      <div className="plans-leaves" aria-hidden="true">
        <Leaf fill="#2d7a3d" style={{ left: -22, top: 120, width: 70, '--r': '32deg' }} />
        <Leaf fill="#e8a92c" style={{ left: 30, top: 175, width: 44, '--r': '68deg' }} />
        <Leaf fill="#5a9a4a" style={{ right: -18, top: 40, width: 76, '--r': '-30deg' }} />
        <Leaf fill="#e8a92c" style={{ right: 52, top: 18, width: 40, '--r': '-62deg' }} />
        <Leaf fill="#2d7a3d" style={{ left: '8%', bottom: -30, width: 64, '--r': '150deg' }} />
        <Leaf fill="#d9541e" style={{ right: '10%', bottom: -24, width: 46, '--r': '-160deg' }} />
      </div>
      <header className="plans-head">
        <img className="plans-logo" src={logo} alt="NeirAPP" />
        <div className="plans-intro">
          <h1>{AVAILABLE_PLANS.length === 1 ? 'Plan para profesionales' : 'Planes para profesionales'}</h1>
          <p>Haz crecer tu presencia en Neira y llega a más personas que necesitan tus servicios.</p>
        </div>
        <button type="button" className="plans-back" onClick={() => navigate('/profesional')}>
          <ArrowLeft size={18} aria-hidden="true" /> Volver a mi panel
        </button>
      </header>

      <main>
        {allowed && <StatusBanner mine={mine} onCancel={mine.cancel} />}
        <ul className={`plans-grid${AVAILABLE_PLANS.length === 1 ? ' single' : ''}`}>
          {AVAILABLE_PLANS.map((plan) => (
            <li key={plan.id}>
              <PlanCard
                plan={plan}
                current={current === plan.id}
                pending={pending?.plan === plan.id}
                blocked={!allowed || mine.loading || Boolean(pending)}
                onChoose={() => setPaying(plan)}
              />
            </li>
          ))}
        </ul>
        {!allowed && (
          <p className="plans-notice" role="status">
            Los planes son para profesionales autorizados. Pídele a un administrador que autorice tu correo.
          </p>
        )}
      </main>

      {paying && (
        <PayDialog
          plan={paying}
          renewing={current === paying.id}
          currentName={current && current !== paying.id ? PLAN_NAMES[current] : ''}
          onSend={(reference) => mine.request(paying.id, reference)}
          onClose={() => setPaying(null)}
        />
      )}
    </div>
  );
}

/** Estado de la suscripción: plan vigente, pago en revisión o pago rechazado. */
function StatusBanner({ mine, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { status, loading } = mine;
  if (loading) return <p className="pl-status">Cargando tu plan…</p>;
  if (mine.error) {
    return (
      <p className="pl-status bad" role="alert">
        {mine.error}
      </p>
    );
  }
  const { current, pending, last_rejected: rejected } = status;
  const until = paidUntil(status);

  const cancel = async () => {
    if (!window.confirm('¿Cancelar tu solicitud de plan?')) return;
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
    <div className="pl-banners">
      {current ? (
        <div className={`pl-status ok ${current.plan}`}>
          <CheckCircle2 size={22} aria-hidden="true" />
          <span>
            <strong>Tu plan actual: {current.plan_name}</strong>
            <small>
              Activo hasta el {dayLabel(until)}
              {status.upcoming.length > 0 ? ' (ya incluye tu renovación)' : ''} · {daysLeft(until) === 1 ? 'queda 1 día' : `quedan ${daysLeft(until)} días`}.
            </small>
          </span>
        </div>
      ) : (
        !pending && (
          <div className="pl-status warn">
            <AlertTriangle size={22} aria-hidden="true" />
            <span>
              <strong>Todavía no tienes un plan activo</strong>
              <small>Tu perfil no aparece en el directorio. Elige un plan para que las personas de Neira te encuentren.</small>
            </span>
          </div>
        )
      )}
      {pending && (
        <div className="pl-status wait">
          <Hourglass size={22} aria-hidden="true" />
          <span>
            <strong>Estamos confirmando tu pago del plan {pending.plan_name}</strong>
            <small>
              {pending.payment_reference ? `Comprobante: ${pending.payment_reference}. ` : ''}Te avisaremos apenas quede activo.
            </small>
            {error && <small className="pl-err">{error}</small>}
          </span>
          <button type="button" className="pl-link" disabled={busy} onClick={cancel}>
            Cancelar solicitud
          </button>
        </div>
      )}
      {rejected && !pending && (
        <div className="pl-status bad">
          <X size={22} aria-hidden="true" />
          <span>
            <strong>No pudimos activar tu plan {rejected.plan_name}</strong>
            <small>Motivo: {rejected.note.replace(/\.$/, '')}. Revisa el pago y vuelve a intentarlo.</small>
          </span>
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan, current, pending, blocked, onChoose }) {
  const Icon = PLAN_ICONS[plan.icon];
  const [leafA, leafB] = CARD_LEAVES[plan.id];
  let label = 'Elegir plan';
  if (pending) label = 'Pago en revisión';
  else if (current) label = 'Renovar un mes más';
  return (
    <article className={`plan ${plan.id}${plan.recommended ? ' recommended' : ''}${current ? ' chosen' : ''}`} aria-labelledby={`plan-${plan.id}`}>
      <div className="plan-band" aria-hidden="true">
        <span className="plan-leaves">
          <Leaf fill={leafA} style={{ right: 22, top: -22, width: 48, '--r': '-28deg' }} />
          <Leaf fill={leafB} style={{ right: -6, top: 6, width: 34, '--r': '-70deg' }} />
        </span>
        <span className="plan-icon">
          <Icon size={30} />
        </span>
      </div>
      <div className="plan-body">
        <div className="plan-top">
          <span className="plan-tag">{plan.tag}</span>
          {current ? (
            <span className="plan-badge current">
              <CheckCircle2 size={14} aria-hidden="true" /> Tu plan actual
            </span>
          ) : (
            plan.recommended && (
              <span className="plan-badge">
                <Sparkles size={14} aria-hidden="true" /> Plan recomendado
              </span>
            )
          )}
        </div>
        <h2 id={`plan-${plan.id}`}>{plan.name}</h2>
        <p className="plan-price">
          <strong>{formatCop(plan.price)}</strong>
          <span>{plan.period}</span>
        </p>
        <p className="plan-summary">{plan.summary}</p>
        <hr />
        <h3>{plan.includesTitle}</h3>
        <ul className="plan-features">
          {plan.features.map((f) => (
            <li key={f}>
              <Check size={18} aria-hidden="true" /> {f}
            </li>
          ))}
        </ul>
        <p className="plan-audience">
          <Users size={18} aria-hidden="true" /> {plan.audience}
        </p>
        <button type="button" className={`plan-btn${pending ? ' waiting' : ''}`} disabled={blocked} onClick={onChoose}>
          {pending && <Clock size={18} aria-hidden="true" />}
          {current && !pending && <CheckCircle2 size={18} aria-hidden="true" />}
          {label}
        </button>
      </div>
    </article>
  );
}

/** Ventana de pago: cómo pagar y el número de comprobante para que el administrador lo encuentre. */
function PayDialog({ plan, renewing, currentName, onSend, onClose }) {
  const [reference, setReference] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    box.current?.querySelector('input')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
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
    <div className="pl-scrim" onClick={onClose}>
      <div ref={box} className={`pl-dialog ${plan.id}`} role="dialog" aria-modal="true" aria-labelledby="pl-dialog-title" onClick={(e) => e.stopPropagation()}>
        <div className="pl-dialog-head">
          <h2 id="pl-dialog-title">{sent ? '¡Listo! Recibimos tu solicitud' : `${renewing ? 'Renovar' : 'Activar'} el plan ${plan.name}`}</h2>
          <button type="button" className="pl-close" aria-label="Cerrar" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {sent ? (
          <div className="pl-done">
            <CheckCircle2 size={52} aria-hidden="true" />
            <p>
              Estamos confirmando tu pago. Cuando quede listo te avisamos en <b>Notificaciones</b> y tu plan {plan.name} quedará activo por {PLAN_DAYS} días.
            </p>
            <button type="button" className="pl-primary" onClick={onClose}>
              Entendido
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <p className="pl-total">
              <span>Total a pagar</span>
              <strong>{formatCop(plan.price)}</strong>
              <small>por {PLAN_DAYS} días</small>
            </p>
            {currentName && (
              <p className="pl-hint">
                Tu plan {currentName} se cambia por el {plan.name} apenas confirmemos el pago.
              </p>
            )}
            {renewing && <p className="pl-hint">El mes nuevo empieza cuando termine el que ya tienes pagado: no pierdes días.</p>}

            <div className="pl-steps">
              <h3>1. Paga</h3>
              {PAYMENT.methods.length > 0 ? (
                <ul className="pl-methods">
                  {PAYMENT.methods.map((m) => (
                    <li key={m.label}>
                      <span>{m.label}</span>
                      <strong>{m.value}</strong>
                    </li>
                  ))}
                  <li className="pl-holder">A nombre de {PAYMENT.holder}</li>
                </ul>
              ) : (
                <p className="pl-hint">Envía la solicitud y el equipo de NeirAPP te escribirá por WhatsApp con los datos para pagar.</p>
              )}
              <h3>2. Cuéntanos cómo pagaste</h3>
              <label className="pl-field">
                <span>
                  Número de comprobante <span className="pl-optional">(opcional)</span>
                </span>
                <input value={reference} maxLength={120} placeholder="Ej: Nequi M1234567" onChange={(e) => setReference(e.target.value)} />
                <small>Nos ayuda a encontrar tu pago más rápido.</small>
              </label>
            </div>

            {error && (
              <p className="pl-err" role="alert">
                {error}
              </p>
            )}
            <div className="pl-actions">
              <button type="button" className="pl-ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="pl-primary" disabled={sending}>
                {sending && <Loader2 size={18} className="pl-spin" aria-hidden="true" />} Enviar solicitud
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

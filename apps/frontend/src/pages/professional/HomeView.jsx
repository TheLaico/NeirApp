import { AlertTriangle, ArrowRight, BriefcaseBusiness, ChevronRight, Crown, Hourglass, Lightbulb, MessageCircle, Sprout } from 'lucide-react';
import neira from '../../assets/professionals/fondo.png';
import SolidIcon from '../../components/icons/Solid.jsx';
import { dayLabel, paidUntil } from '../../features/professionals/subscription.js';
import { QUICK_ACCESS, relevantItems } from './model.js';

const PLAN_ICON = { basic: Sprout, pro: BriefcaseBusiness, premium: Crown };

const RELEVANT_ICON = { requests: MessageCircle, tips: Lightbulb };

/**
 * Inicio del panel del profesional: bienvenida con su plan actual, estado del perfil, accesos rápidos, avisos y
 * recursos. `plan` es el estado de `GET /professionals/me/plan` (null mientras carga).
 */
export default function HomeView({ name, activity, plan, published, listed, onGo, onPlans }) {
  const relevant = relevantItems(activity);
  const current = plan?.current;
  const live = Boolean(current && published && listed);
  let headline = 'Tu perfil profesional está activo en Neira.';
  if (!plan) headline = '';
  else if (!published) headline = 'Arma tu perfil para que las personas de Neira te conozcan.';
  else if (!current && plan.pending) headline = `Estamos confirmando el pago de tu plan ${plan.pending.plan_name}. Te avisaremos cuando tu perfil quede publicado.`;
  else if (!current) headline = 'Tu perfil aún no aparece en el directorio: elige un plan para publicarlo.';
  else if (!listed) headline = 'Tu perfil está oculto. Puedes volver a mostrarlo en Configuración.';

  return (
    <div className="pro-home">
      <section className="pro-hero">
        <img className="pro-hero-art" src={neira} alt="" aria-hidden="true" />
        <div className="pro-hero-body">
          <h1>
            ¡Bienvenido,
            <br />
            {name}!
          </h1>
          {plan && <PlanChip plan={plan} onClick={onPlans} />}
          {headline && <p>{headline}</p>}
          <button type="button" className="pro-cta" onClick={() => onGo('profile')}>
            Personalizar mi perfil <ArrowRight size={20} aria-hidden="true" />
          </button>
        </div>
      </section>

      <button type="button" className="pro-status" onClick={() => onGo('profile')}>
        <span className="md-bubble">
          <SolidIcon name="user" size={26} />
        </span>
        <span className="pro-status-text">
          <strong>Tu perfil profesional</strong>
          <span>Mantén tu información actualizada para que más personas te encuentren.</span>
        </span>
        {plan && (
          <span className={`pro-live${live ? '' : ' off'}`}>
            <i aria-hidden="true" /> {live ? 'Publicado' : 'No publicado'}
          </span>
        )}
        <ChevronRight size={22} aria-hidden="true" className="pro-chev" />
      </button>

      <section aria-labelledby="pro-quick">
        <h2 id="pro-quick" className="pro-title">
          Accesos rápidos
        </h2>
        <ul className="pro-quick">
          {QUICK_ACCESS.map(({ key, title, text, icon, tone }) => (
            <li key={key}>
              <button type="button" onClick={() => onGo(key)}>
                <span className={`pro-quick-ico ${tone}`}>
                  <SolidIcon name={icon} size={26} />
                </span>
                <strong>{title}</strong>
                <span>{text}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pro-relevant">
        <div className="pro-title-row">
          <h2 id="pro-relevant" className="pro-title">
            Lo más relevante para ti
          </h2>
          <button type="button" className="md-more" onClick={() => onGo('notifications')}>
            Ver todos <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
        {relevant.length === 0 ? (
          <p className="md-empty">Aquí verás lo que pase con tu perfil.</p>
        ) : (
          <ul className="pro-relevant">
            {relevant.map(({ id, kind, go, title, text }) => {
              const Icon = RELEVANT_ICON[kind];
              return (
                <li key={id}>
                  <button type="button" onClick={() => onGo(go)}>
                    <span className={`md-bubble sm ${kind === 'tips' ? 'gold' : ''}`}>
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="md-notice-text">
                      <strong>{title}</strong>
                      <span>{text}</span>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" className="md-chev" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button type="button" className="pro-growth" onClick={onPlans}>
        <Sprout size={26} aria-hidden="true" />
        <span className="pro-growth-text">
          <strong>Tu crecimiento también importa</strong>
          <span>Conoce las herramientas y recursos que te ayudarán a hacer crecer tu presencia profesional en Neira.</span>
        </span>
        <span className="pro-growth-link">
          {current ? 'Ver mi plan' : 'Ver planes'} <ChevronRight size={15} aria-hidden="true" />
        </span>
      </button>
    </div>
  );
}

/** Plan actual junto al nombre: "Plan Premium · hasta el 21 de octubre", o el aviso de que no tiene uno. */
function PlanChip({ plan, onClick }) {
  const { current, pending } = plan;
  if (current) {
    const Icon = PLAN_ICON[current.plan];
    return (
      <button type="button" className={`pro-plan ${current.plan}`} onClick={onClick} aria-label={`Plan ${current.plan_name}, activo hasta el ${dayLabel(paidUntil(plan))}. Ver planes`}>
        <Icon size={17} aria-hidden="true" />
        <strong>Plan {current.plan_name}</strong>
        <span className="long">· hasta el {dayLabel(paidUntil(plan))}</span>
        <span className="short">· hasta el {new Date(paidUntil(plan)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
      </button>
    );
  }
  if (pending) {
    return (
      <button type="button" className="pro-plan wait" onClick={onClick}>
        <Hourglass size={17} aria-hidden="true" />
        <strong>Plan {pending.plan_name}</strong>
        <span>· pago en revisión</span>
      </button>
    );
  }
  return (
    <button type="button" className="pro-plan none" onClick={onClick}>
      <AlertTriangle size={17} aria-hidden="true" />
      <strong>Sin plan activo</strong>
      <span>· elegir plan</span>
    </button>
  );
}

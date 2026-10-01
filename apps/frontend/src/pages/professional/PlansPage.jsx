import { ArrowLeft, BriefcaseBusiness, Check, CheckCircle2, Crown, Sparkles, Sprout, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import logo from '../../assets/logo-neirapp.png';
import { Leaf } from '../../components/common/Leaf.jsx';
import { formatCop } from '../../lib/money.js';
import { useNavigate } from '../../lib/router.jsx';
import { PLANS } from './plans.js';
import './plans-page.css';

const PLAN_ICONS = { Sprout, BriefcaseBusiness, Crown };

// Hojas de cada tarjeta, en la esquina de su encabezado (se mecen al pasar el cursor).
const CARD_LEAVES = {
  basic: ['#5a9a4a', '#e8a92c'],
  pro: ['#2d7a3d', '#e8a92c'],
  premium: ['#e8a92c', '#2d7a3d'],
};

/** Página "Planes para profesionales": los tres planes de suscripción lado a lado (en celular, uno debajo del otro). */
export default function PlansPage() {
  const navigate = useNavigate();
  const [chosen, setChosen] = useState(null);
  const chosenPlan = PLANS.find((p) => p.id === chosen);

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
          <h1>Planes para profesionales</h1>
          <p>Haz crecer tu presencia en Neira y llega a más personas que necesitan tus servicios.</p>
        </div>
        <button type="button" className="plans-back" onClick={() => navigate('/profesional')}>
          <ArrowLeft size={18} aria-hidden="true" /> Volver a mi panel
        </button>
      </header>

      <main>
        <ul className="plans-grid">
          {PLANS.map((plan) => (
            <li key={plan.id}>
              <PlanCard plan={plan} chosen={chosen === plan.id} onChoose={() => setChosen(plan.id)} />
            </li>
          ))}
        </ul>
        {chosenPlan && (
          <p className="plans-notice" role="status">
            Elegiste el plan <strong>{chosenPlan.name}</strong>. Muy pronto podrás activarlo desde aquí.
          </p>
        )}
      </main>
    </div>
  );
}

function PlanCard({ plan, chosen, onChoose }) {
  const Icon = PLAN_ICONS[plan.icon];
  const [leafA, leafB] = CARD_LEAVES[plan.id];
  return (
    <article className={`plan ${plan.id}${plan.recommended ? ' recommended' : ''}${chosen ? ' chosen' : ''}`} aria-labelledby={`plan-${plan.id}`}>
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
          {plan.recommended && (
            <span className="plan-badge">
              <Sparkles size={14} aria-hidden="true" /> Plan recomendado
            </span>
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
        <button type="button" className="plan-btn" aria-pressed={chosen} onClick={onChoose}>
          {chosen ? (
            <>
              <CheckCircle2 size={18} aria-hidden="true" /> Plan elegido
            </>
          ) : (
            'Elegir plan'
          )}
        </button>
      </div>
    </article>
  );
}

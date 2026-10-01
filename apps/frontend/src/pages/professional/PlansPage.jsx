import { ArrowLeft, Check, CheckCircle2, Sparkles, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import logo from '../../assets/logo-neirapp.png';
import { formatCop } from '../../lib/money.js';
import { useNavigate } from '../../lib/router.jsx';
import { PLANS } from './plans.js';
import './plans-page.css';

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
              <article className={`plan${plan.recommended ? ' recommended' : ''}${chosen === plan.id ? ' chosen' : ''}`} aria-labelledby={`plan-${plan.id}`}>
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
                <button type="button" className="plan-btn" aria-pressed={chosen === plan.id} onClick={() => setChosen(plan.id)}>
                  {chosen === plan.id ? (
                    <>
                      <CheckCircle2 size={18} aria-hidden="true" /> Plan elegido
                    </>
                  ) : (
                    'Elegir plan'
                  )}
                </button>
              </article>
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

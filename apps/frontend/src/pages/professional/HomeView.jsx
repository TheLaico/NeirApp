import { ArrowRight, ChevronRight, Lightbulb, MessageCircle, Sprout } from 'lucide-react';
import neira from '../../assets/professionals/fondo.png';
import SolidIcon from '../../components/icons/Solid.jsx';
import { QUICK_ACCESS, relevantItems } from './model.js';

const RELEVANT_ICON = { requests: MessageCircle, tips: Lightbulb };

/** Inicio del panel del profesional: bienvenida, estado del perfil, accesos rápidos, avisos y recursos. */
export default function HomeView({ name, activity, onGo }) {
  const relevant = relevantItems(activity);

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
          <p>Tu perfil profesional está activo en Neira.</p>
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
        <span className="pro-live">
          <i aria-hidden="true" /> Activo
        </span>
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

      <aside className="pro-growth">
        <Sprout size={26} aria-hidden="true" />
        <div>
          <h2>Tu crecimiento también importa</h2>
          <p>Conoce las herramientas y recursos que te ayudarán a hacer crecer tu presencia profesional en Neira.</p>
        </div>
      </aside>
    </div>
  );
}

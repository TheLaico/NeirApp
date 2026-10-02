import { AlertTriangle, ArrowRight, Building2, CheckCircle2, ChevronRight, Circle, Eye, Hourglass, Images, Receipt } from 'lucide-react';
import banner from '../../assets/Proveedores/fondo-card-proveedores.webp';
import { dayLabel, isPaid } from '../../features/suppliers/model.js';

const QUICK = [
  { key: 'company', title: 'Mi empresa', text: 'Nombre, descripción, contacto y redes.', Icon: Building2, tone: 'green' },
  { key: 'catalog', title: 'Catálogo', text: 'Sube tu brochure de productos.', Icon: Images, tone: 'blue' },
  { key: 'subscription', title: 'Suscripción', text: 'Paga o renueva tu mes.', Icon: Receipt, tone: 'gold' },
  { key: 'public', title: 'Ver cómo me ven', text: 'Tu tarjeta en Proveedores.', Icon: Eye, tone: 'terra' },
];

/** Inicio del panel del proveedor: bienvenida, si aparece o no en Proveedores, accesos rápidos y qué le falta. */
export default function HomeView({ user, supplier, subscription, onGo, onPublic }) {
  const paid = isPaid(subscription?.paid_until);
  const pending = subscription?.pending;
  const live = Boolean(supplier && paid && supplier.is_listed);
  const name = supplier?.company_name || user.name;

  let status;
  if (!supplier) status = { tone: 'warn', Icon: AlertTriangle, text: 'Crea el perfil de tu empresa para empezar.', go: 'company' };
  else if (live) status = { tone: 'ok', Icon: CheckCircle2, text: `Tu empresa aparece en Proveedores hasta el ${dayLabel(subscription.paid_until)}.`, go: 'subscription' };
  else if (pending) status = { tone: 'wait', Icon: Hourglass, text: 'Estamos confirmando tu pago. Te avisaremos cuando aparezcas en Proveedores.', go: 'subscription' };
  else if (paid) status = { tone: 'warn', Icon: AlertTriangle, text: 'Tu empresa está oculta. Vuelve a mostrarla en Mi empresa.', go: 'company' };
  else status = { tone: 'warn', Icon: AlertTriangle, text: 'Tu empresa no aparece todavía: activa tu suscripción.', go: 'subscription' };

  const checklist = [
    { done: Boolean(supplier), label: 'Crea el perfil de tu empresa', go: 'company' },
    { done: Boolean(supplier?.logo_url), label: 'Sube tu logo', go: 'company' },
    { done: Boolean(supplier?.cover_url), label: 'Agrega una foto de portada', go: 'company' },
    { done: Boolean(supplier?.catalog_url), label: 'Sube tu catálogo (brochure)', go: 'catalog' },
    { done: Boolean(supplier?.whatsapp || supplier?.facebook || supplier?.instagram), label: 'Agrega WhatsApp o redes sociales', go: 'company' },
    { done: paid, label: 'Activa tu suscripción', go: 'subscription' },
  ];
  const done = checklist.filter((c) => c.done).length;

  return (
    <div className="spp-home">
      <section className="spp-hero">
        <div className="spp-hero-text">
          <h1>
            ¡Bienvenido,
            <br />
            {name}!
          </h1>
          <button type="button" className={`spp-status ${status.tone}`} onClick={() => onGo(status.go)}>
            <status.Icon size={18} aria-hidden="true" /> {status.text}
          </button>
          <button type="button" className="sp-btn primary" onClick={() => onGo(supplier ? 'catalog' : 'company')}>
            {supplier ? 'Actualizar mi catálogo' : 'Crear mi empresa'} <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
        <img className="spp-hero-art" src={banner} alt="" aria-hidden="true" />
      </section>

      <section aria-labelledby="spp-quick">
        <h2 id="spp-quick" className="pro-title">
          Accesos rápidos
        </h2>
        <ul className="spp-quick">
          {QUICK.map(({ key, title, text, Icon, tone }) => (
            <li key={key}>
              <button type="button" onClick={() => (key === 'public' ? onPublic() : onGo(key))}>
                <span className={`spp-quick-ico ${tone}`}>
                  <Icon size={24} aria-hidden="true" />
                </span>
                <strong>{title}</strong>
                <span>{text}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="spp-check" aria-labelledby="spp-check-title">
        <div className="pro-title-row">
          <h2 id="spp-check-title" className="pro-title">
            Completa tu perfil
          </h2>
          <span className="spp-progress">
            {done} de {checklist.length}
          </span>
        </div>
        <div className="spp-bar" aria-hidden="true">
          <span style={{ width: `${(done / checklist.length) * 100}%` }} />
        </div>
        <ul>
          {checklist.map((c) => (
            <li key={c.label}>
              <button type="button" className={c.done ? 'done' : ''} onClick={() => onGo(c.go)}>
                {c.done ? <CheckCircle2 size={20} aria-hidden="true" /> : <Circle size={20} aria-hidden="true" />}
                <span>{c.label}</span>
                {!c.done && <ChevronRight size={18} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

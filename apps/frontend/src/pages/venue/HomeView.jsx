import { AlertTriangle, ArrowRight, CalendarCheck, CheckCircle2, ChevronRight, Circle, Eye, Star, Store } from 'lucide-react';
import { Stars } from '../lodging/Stars.jsx';

const QUICK = [
  { key: 'venue', title: 'Mi lugar', text: 'Fotos, horario, servicios y ubicación.', Icon: Store, tone: 'green' },
  { key: 'bookings', title: 'Reservas', text: 'Confirma o rechaza solicitudes.', Icon: CalendarCheck, tone: 'blue' },
  { key: 'reviews', title: 'Reseñas', text: 'Responde a tus clientes.', Icon: Star, tone: 'gold' },
  { key: 'public', title: 'Ver cómo me ven', text: 'Tu ficha en Reservas.', Icon: Eye, tone: 'terra' },
];

/** Inicio del panel del establecimiento: si aparece en Reservas, lo pendiente (reservas y reseñas) y qué le falta. */
export default function HomeView({ user, venue: hotel, pending, unanswered, onGo, onPublic }) {
  const name = hotel?.name || user.name;
  let status;
  if (!hotel) status = { tone: 'warn', Icon: AlertTriangle, text: 'Crea la ficha de tu lugar para aparecer en Reservas.', go: 'venue' };
  else if (!hotel.is_listed) status = { tone: 'warn', Icon: AlertTriangle, text: 'Tu lugar está oculto. Vuelve a mostrarlo en Mi lugar.', go: 'venue' };
  else if (pending) status = { tone: 'wait', Icon: CalendarCheck, text: pending === 1 ? 'Tienes 1 reserva esperando respuesta.' : `Tienes ${pending} reservas esperando respuesta.`, go: 'bookings' };
  else status = { tone: 'ok', Icon: CheckCircle2, text: 'Tu lugar aparece en Reservas.', go: 'venue' };

  const checklist = [
    { done: Boolean(hotel), label: 'Crea la ficha de tu lugar', go: 'venue' },
    { done: (hotel?.photos.length ?? 0) >= 4, label: 'Sube al menos 4 fotos', go: 'venue' },
    { done: (hotel?.features.length ?? 0) >= 3, label: 'Marca los servicios que ofreces', go: 'venue' },
    { done: Boolean(hotel?.whatsapp), label: 'Agrega tu WhatsApp para reservas', go: 'venue' },
    { done: Boolean(hotel?.tagline), label: 'Escribe una frase corta', go: 'venue' },
    { done: Boolean(hotel) && unanswered === 0, label: 'Responde todas tus reseñas', go: 'reviews' },
  ];
  const done = checklist.filter((c) => c.done).length;

  return (
    <div className="spp-home">
      <section className="spp-hero htp-hero">
        <div className="spp-hero-text">
          <h1>
            ¡Bienvenido,
            <br />
            {name}!
          </h1>
          <button type="button" className={`spp-status ${status.tone}`} onClick={() => onGo(status.go)}>
            <status.Icon size={18} aria-hidden="true" /> {status.text}
          </button>
          <button type="button" className="sp-btn primary" onClick={() => onGo(hotel ? 'bookings' : 'venue')}>
            {hotel ? 'Ver mis reservas' : 'Crear mi lugar'} <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
        {hotel?.photos[0] && <img className="spp-hero-art htp-hero-photo" src={hotel.photos[0]} alt="" aria-hidden="true" />}
      </section>

      {hotel && (
        <ul className="htp-stats">
          <li>
            <button type="button" onClick={() => onGo('bookings')}>
              <strong>{pending}</strong>
              <span>{pending === 1 ? 'Reserva por responder' : 'Reservas por responder'}</span>
            </button>
          </li>
          <li>
            <button type="button" onClick={() => onGo('reviews')}>
              <strong>{hotel.reviews_count ? hotel.rating.toLocaleString('es-CO', { minimumFractionDigits: 1 }) : '—'}</strong>
              <span>{hotel.reviews_count ? <Stars value={hotel.rating} size={14} /> : 'Sin calificaciones aún'}</span>
            </button>
          </li>
          <li>
            <button type="button" onClick={() => onGo('reviews')}>
              <strong>{unanswered}</strong>
              <span>{unanswered === 1 ? 'Reseña sin responder' : 'Reseñas sin responder'}</span>
            </button>
          </li>
        </ul>
      )}

      <section aria-labelledby="htp-quick">
        <h2 id="htp-quick" className="pro-title">
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

      <section className="spp-check" aria-labelledby="htp-check-title">
        <div className="pro-title-row">
          <h2 id="htp-check-title" className="pro-title">
            Completa tu ficha
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

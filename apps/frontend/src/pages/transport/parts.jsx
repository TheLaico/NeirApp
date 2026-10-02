import { Phone, UserRound } from 'lucide-react';
import motocarro from '../../assets/Transporte/motocarro.webp';
import { phoneLabel, telLink } from '../../features/rides/model.js';
import { Stars } from '../lodging/Stars.jsx';

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

/** Foto (o iniciales) redonda de una persona. */
export function Avatar({ name, photo, size = 56 }) {
  return (
    <span className="tr-avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {photo ? <img src={photo} alt="" /> : initials(name) || <UserRound size={size * 0.5} aria-hidden="true" />}
    </span>
  );
}

/** El conductor y su motocarro, como los ve el cliente. */
export function DriverInfo({ driver, compact = false }) {
  return (
    <div className={`tr-driver${compact ? ' compact' : ''}`}>
      <Avatar name={driver.name} photo={driver.photo_url} size={compact ? 46 : 58} />
      <div className="tr-driver-text">
        <strong>{driver.name}</strong>
        <span className="tr-rating">
          {driver.rating_count ? (
            <>
              <Stars value={driver.rating} size={13} /> {driver.rating.toLocaleString('es-CO', { minimumFractionDigits: 1 })} ({driver.rating_count})
            </>
          ) : (
            'Conductor verificado'
          )}
        </span>
      </div>
      <div className="tr-plate-box">
        <img src={driver.vehicle_photo_url || motocarro} alt="" />
        <span className="tr-plate">{driver.plate_label}</span>
      </div>
    </div>
  );
}

export function CallButton({ phone, label = 'Llamar', className = 'tr-btn outline' }) {
  if (!phone) return null;
  return (
    <a className={className} href={telLink(phone)} aria-label={`${label} al ${phoneLabel(phone)}`}>
      <Phone size={17} aria-hidden="true" /> {label}
    </a>
  );
}

/** Contador de personas (1 a 3). */
export function PeopleCounter({ value, onChange, max = 3 }) {
  return (
    <div className="tr-counter" role="group" aria-label="Cuántas personas van">
      <button type="button" aria-label="Una persona menos" disabled={value <= 1} onClick={() => onChange(value - 1)}>
        −
      </button>
      <strong aria-live="polite">{value}</strong>
      <button type="button" aria-label="Una persona más" disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

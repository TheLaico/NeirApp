import { formatCop } from '../../lib/money.js';

// Servicios que ofrece un profesional ("Mis servicios"). Mismos límites que la API
// (apps/api/.../professionals/domain/services.py).

export const PRICE_KINDS = [
  { key: 'fixed', label: 'Precio fijo' },
  { key: 'from', label: 'Desde' },
  { key: 'quote', label: 'A convenir' },
];

export const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];
export const SERVICE_DESCRIPTION_MAX = 300;
export const MAX_SERVICES = 30;
const MIN_PRICE = 1000;
const MAX_PRICE = 50_000_000;

export const emptyService = () => ({ name: '', description: '', priceKind: 'fixed', price: '', duration: '', active: true });

export const fromApi = (s) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  priceKind: s.price_kind,
  price: s.price_cop == null ? '' : String(s.price_cop),
  duration: s.duration_minutes == null ? '' : String(s.duration_minutes),
  active: s.is_active,
});

export const toApi = (d) => ({
  name: d.name.trim(),
  description: d.description.trim(),
  price_kind: d.priceKind,
  price_cop: d.priceKind === 'quote' || d.price === '' ? null : Number(d.price),
  duration_minutes: d.duration === '' ? null : Number(d.duration),
  is_active: d.active,
});

/** "$ 80.000", "Desde $ 80.000" o "A convenir". */
export function priceLabel({ priceKind, price }) {
  if (priceKind === 'quote' || price === '' || price == null) return 'A convenir';
  return priceKind === 'from' ? `Desde ${formatCop(Number(price))}` : formatCop(Number(price));
}

/** "30 min", "1 h", "1 h 30 min". */
export function durationLabel(minutes) {
  const m = Number(minutes);
  if (!m) return '';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return [h && `${h} h`, rest && `${rest} min`].filter(Boolean).join(' ');
}

/** Solo dígitos, para el campo de precio ("80.000" -> "80000"). */
export const onlyDigits = (text) => text.replace(/\D/g, '').slice(0, 8);

/** Con puntos de miles mientras se escribe ("80000" -> "80.000"). */
export const groupThousands = (digits) => (digits ? Number(digits).toLocaleString('es-CO') : '');

export function validateService(d) {
  const errors = {};
  const name = d.name.trim();
  if (name.length < 3 || name.length > 80) errors.name = 'Escribe el nombre del servicio (entre 3 y 80 caracteres).';
  if (d.priceKind !== 'quote') {
    const price = Number(d.price);
    if (!d.price || price < MIN_PRICE || price > MAX_PRICE) errors.price = 'Escribe un precio entre $ 1.000 y $ 50.000.000, o elige “A convenir”.';
  }
  return errors;
}

// Ideas para arrancar cuando todavía no hay servicios (al tocarlas se llena el nombre).
export const SERVICE_IDEAS = ['Consulta', 'Visita a domicilio', 'Asesoría virtual', 'Primera cita de valoración', 'Seguimiento'];

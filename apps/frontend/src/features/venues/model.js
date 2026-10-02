import {
  Accessibility,
  Baby,
  Car,
  Coffee,
  Dog,
  Dumbbell,
  Flower2,
  Map as MapIcon,
  Martini,
  Mountain,
  Music,
  PartyPopper,
  Sparkles,
  Sun,
  Trees,
  UtensilsCrossed,
  Waves,
  Wifi,
  Wind,
  Wine,
} from 'lucide-react';
import { formatCop } from '../../lib/money.js';
import { usePersistentState } from '../../lib/usePersistentState.js';

// Tipos de lugar (iguales a `VenueCategory` de la API), con el color de su puntero en el mapa.
export const CATEGORIES = [
  { id: 'restaurant', label: 'Restaurantes', one: 'Restaurante', Icon: UtensilsCrossed, color: '#B6533C' },
  { id: 'cafe', label: 'Cafés', one: 'Café', Icon: Coffee, color: '#8A5A3B' },
  { id: 'bar', label: 'Bares', one: 'Bar', Icon: Wine, color: '#6A4C93' },
  { id: 'sports', label: 'Canchas', one: 'Cancha', Icon: Dumbbell, color: '#2D7A3D' },
  { id: 'events', label: 'Salones de eventos', one: 'Salón de eventos', Icon: PartyPopper, color: '#C0587A' },
  { id: 'recreation', label: 'Recreación', one: 'Centro recreativo', Icon: Trees, color: '#1D8A9C' },
  { id: 'spa', label: 'Spa y bienestar', one: 'Spa', Icon: Flower2, color: '#D1495B' },
  { id: 'tour', label: 'Tours', one: 'Tour o experiencia', Icon: MapIcon, color: '#E8A92C' },
  { id: 'other', label: 'Otros', one: 'Otro', Icon: Sparkles, color: '#0F5238' },
];
export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
/** Puntero del mapa: el icono y el color de su tipo (ver `store.marker` en NeiraMap). */
export const markerOf = (v) => {
  const { Icon, color } = categoryOf(v.category);
  return { Icon, color };
};

// Servicios (iguales a `Feature` de la API). Mismo formato que los de Hospedaje para reusar sus íconos.
export const FEATURES = [
  { id: 'wifi', label: 'WiFi', Icon: Wifi },
  { id: 'parking', label: 'Parqueadero', Icon: Car },
  { id: 'food', label: 'Comida', Icon: UtensilsCrossed },
  { id: 'bar', label: 'Bar', Icon: Martini },
  { id: 'outdoor', label: 'Al aire libre', Icon: Sun },
  { id: 'view', label: 'Vista panorámica', Icon: Mountain },
  { id: 'kids', label: 'Zona para niños', Icon: Baby },
  { id: 'music', label: 'Música en vivo', Icon: Music },
  { id: 'pool', label: 'Piscina', Icon: Waves },
  { id: 'ac', label: 'Aire acondicionado', Icon: Wind },
  { id: 'pets', label: 'Acepta mascotas', Icon: Dog },
  { id: 'accessible', label: 'Acceso para silla de ruedas', Icon: Accessibility },
];
export const featuresOf = (ids = []) => FEATURES.filter((f) => ids.includes(f.id));

export const PRICE_UNITS = [
  { id: 'person', label: 'por persona' },
  { id: 'hour', label: 'por hora' },
  { id: 'booking', label: 'por reserva' },
];
export const unitLabel = (v) => PRICE_UNITS.find((u) => u.id === v.price_unit)?.label ?? '';
/** "Desde $ 25.000 por persona" o "Precio a consultar". */
export const priceLabel = (v) => (v.price_cop ? `${formatCop(v.price_cop)} ${PRICE_UNITS.find((u) => u.id === v.price_unit)?.label ?? ''}` : 'Precio a consultar');

// Días como la API: 0 = lunes … 6 = domingo.
export const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** "3:30 p. m." a partir de "15:30". */
export const timeLabel = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
};
/** "Mar a Dom · 12:00 p. m. – 10:00 p. m." */
export const scheduleLabel = (v) => {
  const days = [...v.open_days].sort();
  const consecutive = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  let dayText;
  if (days.length === 7) dayText = 'Todos los días';
  else if (consecutive && days.length > 2) dayText = `${DAYS[days[0]]} a ${DAYS[days[days.length - 1]]}`;
  else dayText = days.map((d) => DAYS[d]).join(', ');
  return `${dayText} · ${timeLabel(v.open_time)} – ${timeLabel(v.close_time)}`;
};

/** Día de la semana como la API (0 = lunes) para una fecha "AAAA-MM-DD". */
export const weekdayOf = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
};
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
/** Igual que `Venue.is_open_at` de la API (incluye horarios que pasan la medianoche). */
export const isOpenAt = (v, weekday, hhmm) => {
  const start = toMinutes(v.open_time);
  const end = toMinutes(v.close_time);
  const at = toMinutes(hhmm);
  if (start < end) return v.open_days.includes(weekday) && at >= start && at < end;
  if (at >= start) return v.open_days.includes(weekday);
  return at < end && v.open_days.includes((weekday + 6) % 7);
};
/**
 * Horas para reservar ese día, cada media hora dentro del horario, empezando por la apertura: si el lugar cierra
 * después de medianoche, la madrugada (de la noche anterior) queda al final.
 */
export const slotsFor = (v, iso) => {
  const weekday = weekdayOf(iso);
  const open = toMinutes(v.open_time);
  const out = [];
  for (let t = 0; t < 24 * 60; t += 30) {
    const hhmm = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    if (isOpenAt(v, weekday, hhmm)) out.push(hhmm);
  }
  return out.sort((a, b) => ((toMinutes(a) - open + 1440) % 1440) - ((toMinutes(b) - open + 1440) % 1440));
};
export const dayName = (iso) => DAY_NAMES[weekdayOf(iso)];

export const STATUS = {
  pending: { label: 'Esperando respuesta', tone: 'wait' },
  confirmed: { label: 'Confirmada', tone: 'ok' },
  declined: { label: 'No disponible', tone: 'bad' },
  cancelled: { label: 'Cancelada', tone: 'off' },
};

export const whatsappLink = (digits, name) =>
  `https://wa.me/57${digits}?text=${encodeURIComponent(`Hola ${name}, los encontré en Reservas de NeirAPP y quiero hacer una reserva.`)}`;
export const telLink = (digits) => `tel:${digits.length === 10 && digits.startsWith('3') ? `+57${digits}` : digits}`;
export const contactLink = (v) => (v.whatsapp ? whatsappLink(v.whatsapp, v.name) : telLink(v.phone));

/** Lugares guardados con el corazón (solo en este dispositivo). */
export function useVenueFavorites() {
  const [ids, setIds] = usePersistentState('neirapp.reservas.favoritos', []);
  const toggle = (id) => setIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  return { ids, has: (id) => ids.includes(id), toggle };
}

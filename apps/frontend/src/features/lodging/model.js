import {
  Bath,
  BedDouble,
  Car,
  Coffee,
  Dog,
  Flame,
  Hotel,
  House,
  Martini,
  Mountain,
  Tent,
  TreePine,
  Tv,
  UtensilsCrossed,
  WashingMachine,
  Waves,
  Wifi,
  Wind,
} from 'lucide-react';
import { usePersistentState } from '../../lib/usePersistentState.js';

// Tipos de hospedaje (iguales a `HotelKind` de la API).
export const KINDS = [
  { id: 'hotel', label: 'Hotel', Icon: Hotel },
  { id: 'farm', label: 'Finca hotel', Icon: TreePine },
  { id: 'hostel', label: 'Hostal', Icon: BedDouble },
  { id: 'cabin', label: 'Cabañas', Icon: House },
  { id: 'glamping', label: 'Glamping', Icon: Tent },
  { id: 'house', label: 'Casa o apartamento', Icon: House },
];
export const kindOf = (id) => KINDS.find((k) => k.id === id) ?? KINDS[0];

// Servicios (iguales a `Amenity` de la API), en el orden en que se muestran.
export const AMENITIES = [
  { id: 'wifi', label: 'WiFi', Icon: Wifi },
  { id: 'pool', label: 'Piscina', Icon: Waves },
  { id: 'restaurant', label: 'Restaurante', Icon: UtensilsCrossed },
  { id: 'parking', label: 'Parqueadero', Icon: Car },
  { id: 'breakfast', label: 'Desayuno', Icon: Coffee },
  { id: 'view', label: 'Vista panorámica', Icon: Mountain },
  { id: 'bar', label: 'Bar', Icon: Martini },
  { id: 'camping', label: 'Zona de camping', Icon: Tent },
  { id: 'jacuzzi', label: 'Jacuzzi', Icon: Bath },
  { id: 'bbq', label: 'Zona BBQ', Icon: Flame },
  { id: 'ac', label: 'Aire acondicionado', Icon: Wind },
  { id: 'tv', label: 'TV', Icon: Tv },
  { id: 'pets', label: 'Acepta mascotas', Icon: Dog },
  { id: 'laundry', label: 'Lavandería', Icon: WashingMachine },
];
export const amenityOf = (id) => AMENITIES.find((a) => a.id === id);
export const amenitiesOf = (ids = []) => AMENITIES.filter((a) => ids.includes(a.id));

// Marcador de los hoteles en el mapa (ver `store.marker` en NeiraMap).
export const HOTEL_MARKER = { Icon: BedDouble, color: '#B6533C' };

// Planes (iguales a `PLAN_FEES_COP` de la API): cada mes vale 30 días.
export const PLAN_DAYS = 30;
export const PLANS = {
  listing: { fee: 25000, label: 'Aparecer en Hospedaje', short: 'Plan Hospedaje' },
  featured: { fee: 4900, label: 'Hotel destacado', short: 'Destacado' },
};
export const isActive = (until) => Boolean(until) && new Date(until) > new Date();
/** "21 de octubre". */
export const dayLabel = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });

// Igual que `MAX_PHOTOS` de la API.
export const MAX_PHOTOS = 12;
// Lo que abarca el mapa (igual que `LAT_RANGE`/`LNG_RANGE` de la API).
export const inNeira = (lat, lng) => lat >= 5.1485 && lat <= 5.1865 && lng >= -75.5445 && lng <= -75.4985;

export const STATUS = {
  pending: { label: 'Esperando respuesta', tone: 'wait' },
  confirmed: { label: 'Confirmada', tone: 'ok' },
  declined: { label: 'No disponible', tone: 'bad' },
  cancelled: { label: 'Cancelada', tone: 'off' },
};

/** "6068512345" (o "+573101234567") → "606 851 2345". */
export const phoneLabel = (raw = '') => {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('57')) digits = digits.slice(2);
  return digits.length === 10 ? digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3') : digits.replace(/^(\d{3})(\d{4})$/, '$1 $2');
};
export const telLink = (digits) => `tel:${digits.length === 10 && digits.startsWith('3') ? `+57${digits}` : digits}`;
export const whatsappLink = (digits, hotel) =>
  `https://wa.me/57${digits}?text=${encodeURIComponent(`Hola ${hotel}, los encontré en Hospedaje de NeirAPP y quiero información para hospedarme.`)}`;
/**
 * "Cómo llegar": abre Google Maps (gratis, sin clave de API) con la ruta desde donde está la persona hasta el
 * hotel ya trazada. En el celular abre la app de Google Maps si la tiene instalada.
 */
export const directionsLink = (h) => `https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`;
/** Contactar: WhatsApp si lo tiene, si no llamada. */
export const contactLink = (h) => (h.whatsapp ? whatsappLink(h.whatsapp, h.name) : telLink(h.phone));

/** "2026-10-01" → "1 oct 2026" (fechas sin hora: no se corren por la zona horaria). */
export const dateLabel = (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', opts);
};
/** Fecha local en formato "AAAA-MM-DD" (para los <input type="date">). */
export const isoDay = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDay(new Date(y, m - 1, d + n));
};
export const nightsBetween = (from, to) => Math.round((new Date(`${to}T12:00`) - new Date(`${from}T12:00`)) / 86400000);

export const reviewsLabel = (n) => (n === 1 ? '1 reseña' : `${n} reseñas`);

/** Hoteles guardados con el corazón (solo en este dispositivo). */
export function useHotelFavorites() {
  const [ids, setIds] = usePersistentState('neirapp.hospedaje.favoritos', []);
  const toggle = (id) => setIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  return { ids, has: (id) => ids.includes(id), toggle };
}

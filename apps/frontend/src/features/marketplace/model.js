import { BedSingle, Box, BriefcaseBusiness, Building, Building2, House, LandPlot, SquareParking, Store, Trees, Warehouse } from 'lucide-react';
import { formatCop } from '../../lib/money.js';
import { usePersistentState } from '../../lib/usePersistentState.js';

// Lo que cuesta publicar (igual que `LISTING_FEE_COP` de la API) y cómo se paga mientras no haya pasarela.
export const LISTING_FEE = 10000;
export const LISTING_DAYS = 30;

export const CATEGORIES = [
  { id: 'house', label: 'Casas', Icon: House },
  { id: 'apartment', label: 'Apartamentos', Icon: Building2 },
  { id: 'building', label: 'Edificios', Icon: Building },
  { id: 'commercial', label: 'Locales comerciales', Icon: Store },
  { id: 'office', label: 'Oficinas y consultorios', Icon: BriefcaseBusiness },
  { id: 'farm', label: 'Fincas y casas campestres', Icon: Trees },
  { id: 'lot', label: 'Lotes y terrenos', Icon: LandPlot },
  { id: 'warehouse', label: 'Bodegas', Icon: Warehouse },
  { id: 'room', label: 'Habitaciones', Icon: BedSingle },
  { id: 'parking', label: 'Parqueaderos', Icon: SquareParking },
  { id: 'other', label: 'Otros', Icon: Box },
];
export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

export const KINDS = { sale: 'Venta', rent: 'Alquiler' };
export const RENT_PERIODS = [
  { id: 'day', label: 'Por día', suffix: 'día' },
  { id: 'week', label: 'Por semana', suffix: 'semana' },
  { id: 'month', label: 'Por mes', suffix: 'mes' },
];

/** "$ 180.000 / mes", "$ 950.000" o "Precio a convenir". */
export function priceLabel(item) {
  if (item.price_cop == null) return 'Precio a convenir';
  const base = formatCop(item.price_cop);
  if (item.kind !== 'rent') return base;
  const period = RENT_PERIODS.find((p) => p.id === item.rent_period) ?? RENT_PERIODS[2];
  return `${base} / ${period.suffix}`;
}

// Rangos pensados para inmuebles: los primeros sirven para arriendos y los altos para ventas.
const M = 1000000;
const between = (lo, hi) => (i) => i.price_cop != null && i.price_cop > lo && i.price_cop <= hi;
export const PRICE_RANGES = [
  { id: 'all', label: 'Cualquier precio', test: () => true },
  { id: 'u1m', label: 'Hasta $ 1.000.000', test: between(0, M) },
  { id: '1-3m', label: '$ 1.000.000 a $ 3.000.000', test: between(M, 3 * M) },
  { id: '3-150m', label: '$ 3.000.000 a $ 150.000.000', test: between(3 * M, 150 * M) },
  { id: '150-400m', label: '$ 150 a $ 400 millones', test: between(150 * M, 400 * M) },
  { id: 'o400m', label: 'Más de $ 400 millones', test: (i) => i.price_cop != null && i.price_cop > 400 * M },
  { id: 'negotiable', label: 'Negociable', test: (i) => i.negotiable },
];

const WEEK = 7 * 86400000;
export const AVAILABILITY = [
  { id: 'all', label: 'Cualquiera', test: () => true },
  { id: 'many', label: 'Varias unidades', test: (i) => i.quantity > 1 },
  { id: 'new', label: 'Publicados esta semana', test: (i) => Date.now() - new Date(i.created_at) < WEEK },
];

export const REPORT_REASONS = [
  { id: 'inappropriate', label: 'Contenido inapropiado u ofensivo' },
  { id: 'scam', label: 'Posible estafa o fraude' },
  { id: 'misleading', label: 'Información falsa o engañosa' },
  { id: 'prohibited', label: 'No es un inmueble o es contenido prohibido' },
  { id: 'spam', label: 'Spam o publicación repetida' },
  { id: 'other', label: 'Otro motivo' },
];
export const reasonLabel = (id) => REPORT_REASONS.find((r) => r.id === id)?.label ?? id;

/** Chat de WhatsApp con el vendedor, con un saludo que menciona el inmueble. */
export const sellerChat = (item) =>
  `https://wa.me/57${item.whatsapp}?text=${encodeURIComponent(`Hola${item.seller_name ? ` ${item.seller_name}` : ''}, vi tu publicación “${item.title}” en MarquetNeira y me interesa.`)}`;

export const unitsLabel = (n) => (n === 1 ? '1 disponible' : `${n} disponibles`);

/** Favoritos de MarquetNeira, guardados en este dispositivo. */
export function useMarketFavorites() {
  const [ids, setIds] = usePersistentState('neirapp.marquet.favoritos', []);
  const toggle = (id) => setIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  return { ids, has: (id) => ids.includes(id), toggle };
}

import { Armchair, BedDouble, Box, BriefcaseBusiness, CookingPot, DoorClosed, Flower2, Lamp, Sofa, Table2, Trees, UtensilsCrossed } from 'lucide-react';
import { formatCop } from '../../lib/money.js';
import { usePersistentState } from '../../lib/usePersistentState.js';

// Lo que cuesta publicar (igual que `LISTING_FEE_COP` de la API) y cómo se paga mientras no haya pasarela.
export const LISTING_FEE = 10000;
export const LISTING_DAYS = 30;

export const CATEGORIES = [
  { id: 'living', label: 'Salas y sofás', Icon: Sofa },
  { id: 'dining', label: 'Comedores', Icon: UtensilsCrossed },
  { id: 'bedroom', label: 'Camas y colchones', Icon: BedDouble },
  { id: 'wardrobe', label: 'Armarios y clósets', Icon: DoorClosed },
  { id: 'office', label: 'Escritorios y oficina', Icon: BriefcaseBusiness },
  { id: 'chairs', label: 'Sillas y poltronas', Icon: Armchair },
  { id: 'tables', label: 'Mesas', Icon: Table2 },
  { id: 'kitchen', label: 'Cocina', Icon: CookingPot },
  { id: 'outdoor', label: 'Exterior y jardín', Icon: Trees },
  { id: 'decor', label: 'Decoración', Icon: Lamp },
  { id: 'other', label: 'Otros', Icon: Box },
];
export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) ?? { id, label: 'Otros', Icon: Flower2 };

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

export const PRICE_RANGES = [
  { id: 'all', label: 'Cualquier precio', test: () => true },
  { id: 'u200', label: 'Hasta $ 200.000', test: (i) => i.price_cop != null && i.price_cop <= 200000 },
  { id: '200-500', label: '$ 200.000 a $ 500.000', test: (i) => i.price_cop != null && i.price_cop > 200000 && i.price_cop <= 500000 },
  { id: '500-1m', label: '$ 500.000 a $ 1.000.000', test: (i) => i.price_cop != null && i.price_cop > 500000 && i.price_cop <= 1000000 },
  { id: 'o1m', label: 'Más de $ 1.000.000', test: (i) => i.price_cop != null && i.price_cop > 1000000 },
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
  { id: 'prohibited', label: 'No es un mueble o es un producto prohibido' },
  { id: 'spam', label: 'Spam o publicación repetida' },
  { id: 'other', label: 'Otro motivo' },
];
export const reasonLabel = (id) => REPORT_REASONS.find((r) => r.id === id)?.label ?? id;

/** Chat de WhatsApp con el vendedor, con un saludo que menciona el mueble. */
export const sellerChat = (item) =>
  `https://wa.me/57${item.whatsapp}?text=${encodeURIComponent(`Hola${item.seller_name ? ` ${item.seller_name}` : ''}, vi tu publicación “${item.title}” en MarquetNeira y me interesa.`)}`;

export const unitsLabel = (n) => (n === 1 ? '1 disponible' : `${n} disponibles`);

/** Favoritos de MarquetNeira, guardados en este dispositivo. */
export function useMarketFavorites() {
  const [ids, setIds] = usePersistentState('neirapp.marquet.favoritos', []);
  const toggle = (id) => setIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  return { ids, has: (id) => ids.includes(id), toggle };
}

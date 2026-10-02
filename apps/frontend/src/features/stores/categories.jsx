import { Coffee, Ellipsis, Pill, ShoppingCart, Utensils } from 'lucide-react';
import { NEIRA_CENTER } from '../map/constants.js';

// Grupos que se ven en la barra superior. "mas" no filtra: es un acceso a otras categorías.
export const GROUPS = {
  alimentos: { label: 'Alimentos', color: '#E8621C', Icon: Utensils },
  bebidas: { label: 'Bebidas', color: '#1F6B46', Icon: Coffee },
  mercados: { label: 'Mercados', color: '#E8A92C', Icon: ShoppingCart },
  farmacias: { label: 'Farmacias', color: '#1D8A9C', Icon: Pill },
  mas: { label: 'Más', color: '#8A9A8A', Icon: Ellipsis },
};

// Categoría de la API -> grupo visual.
const GROUP_OF = {
  restaurant: 'alimentos',
  bakery: 'alimentos',
  cafe: 'bebidas',
  supermarket: 'mercados',
  general: 'mercados',
  pharmacy: 'farmacias',
};

export const CATEGORY_LABEL = {
  restaurant: 'Restaurante',
  bakery: 'Panadería',
  cafe: 'Bebidas',
  supermarket: 'Mercado',
  general: 'Tienda',
  pharmacy: 'Farmacia',
};

export const groupOf = (category) => GROUP_OF[category] ?? 'mercados';

const [CLNG, CLAT] = NEIRA_CENTER;

// Distancia aproximada (m) desde el centro de Neira.
const distanceFromCenter = (lat, lng) => {
  const dy = (lat - CLAT) * 111320;
  const dx = (lng - CLNG) * 111320 * Math.cos((CLAT * Math.PI) / 180);
  return Math.round(Math.hypot(dx, dy));
};

export const formatDistance = (m) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);

/** Convierte una tienda de la API al formato que usa la interfaz. */
export function normalizeStore(store) {
  const group = groupOf(store.category);
  return {
    id: store.id,
    name: store.name,
    category: store.category,
    label: CATEGORY_LABEL[store.category] ?? 'Tienda',
    group,
    rating: store.rating,
    reviews: store.reviews_count,
    distance: distanceFromCenter(store.lat, store.lng),
    color: GROUPS[group].color,
    Icon: GROUPS[group].Icon,
    lat: store.lat,
    lng: store.lng,
    is_open: store.is_open,
    is_open_manual: store.is_open_manual,
    closed_reason: store.closed_reason,
    next_open_at: store.next_open_at,
    description: store.description,
    image_url: store.image_url,
    logo_url: store.logo_url ?? null,
    recommended_position: store.recommended_position ?? null,
    // Solo el panel de administrador los usa (la lista pública no trae el correo).
    is_listed: store.is_listed !== false,
    is_approved: store.is_approved,
    owner_email: store.owner_email ?? '',
  };
}

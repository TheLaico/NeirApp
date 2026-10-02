import { Apple, Box, Cpu, Hammer, HardHat, HeartPulse, Lamp, Package, PenLine, Shirt, Sparkles, Sprout } from 'lucide-react';

// Suscripción: igual que `SUBSCRIPTION_FEE_COP` de la API.
export const SUBSCRIPTION_FEE = 24900;
export const SUBSCRIPTION_DAYS = 30;

/** "21 de octubre". */
export const dayLabel = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
export const isPaid = (paidUntil) => Boolean(paidUntil) && new Date(paidUntil) > new Date();

// Categorías de proveedores (iguales a `SupplierCategory` de la API). Las primeras salen como botones; el resto en "Más".
export const CATEGORIES = [
  { id: 'food', label: 'Alimentos y bebidas', Icon: Apple, color: '#2d7a3d' },
  { id: 'cleaning', label: 'Aseo y limpieza', Icon: Sparkles, color: '#1d7fa8' },
  { id: 'construction', label: 'Construcción', Icon: HardHat, color: '#b0702a' },
  { id: 'hardware', label: 'Ferretería', Icon: Hammer, color: '#5b6470' },
  { id: 'clothing', label: 'Ropa y calzado', Icon: Shirt, color: '#8a4f9e' },
  { id: 'technology', label: 'Tecnología', Icon: Cpu, color: '#2f5e9e' },
  { id: 'agro', label: 'Agro e insumos', Icon: Sprout, color: '#5a9a4a' },
  { id: 'stationery', label: 'Papelería y oficina', Icon: PenLine, color: '#c0587a' },
  { id: 'health', label: 'Salud y belleza', Icon: HeartPulse, color: '#d1495b' },
  { id: 'home', label: 'Hogar y decoración', Icon: Lamp, color: '#a86b3c' },
  { id: 'packaging', label: 'Empaques y desechables', Icon: Package, color: '#6a7f3a' },
  { id: 'other', label: 'Otros', Icon: Box, color: '#0f5238' },
];
export const MAIN_CATEGORIES = 6;
export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

/** "6068512345" → "606 851 2345", "3101234567" → "310 123 4567". */
export const phoneLabel = (digits = '') =>
  digits.length === 10 ? digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3') : digits.replace(/^(\d{3})(\d{4})$/, '$1 $2');

export const telLink = (digits) => `tel:${digits.length === 10 && digits.startsWith('3') ? `+57${digits}` : digits}`;
export const whatsappLink = (digits, company) =>
  `https://wa.me/57${digits}?text=${encodeURIComponent(`Hola ${company}, los encontré en Proveedores de NeirAPP y quiero información de sus productos al por mayor.`)}`;

/** Iniciales para el logo cuando la empresa no ha subido uno. */
export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || name.slice(0, 2).toUpperCase();

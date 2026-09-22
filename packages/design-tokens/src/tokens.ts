/**
 * Fuente de verdad de la identidad visual (Neira, Caldas).
 * Web: se refleja en `theme.css`. Móvil (React Native) y el estilo del mapa consumen este archivo.
 * Proporción objetivo: 60% crema/blanco · 25% verdes · 10% terracota · 5% amarillo/azul/funcionales.
 */
export const colors = {
  // Marca
  brand: "#236B4A", // Verde Neira: acciones principales, estados activos
  brandDeep: "#174936", // Verde profundo: navbar, encabezados, fondos oscuros
  brandSoft: "#DCEBDD", // Verde suave: fondos secundarios, etiquetas
  terracotta: "#B6533C", // Acento: promociones, favoritos. Nunca dominante
  panela: "#D9A441", // Acento secundario: ofertas, populares, calificaciones
  // Superficies y texto
  cream: "#F8F5ED", // Fondo general (en vez de blanco puro)
  white: "#FFFFFF", // Tarjetas, modales, formularios
  ink: "#202724", // Carbón: títulos, precios
  muted: "#66736D", // Gris: texto secundario
  line: "#DDE3DE", // Gris claro: bordes y divisores
  // Funcionales
  info: "#4A7C8C", // Producto listo / información
} as const;

/** Estados de un pedido. Cada estado debe ir SIEMPRE acompañado de icono y etiqueta. */
export const orderStatusColors = {
  pending: colors.panela,
  preparing: colors.panela,
  ready: colors.info,
  onTheWay: colors.brandDeep,
  delivered: colors.brand,
  issue: colors.terracotta,
} as const;

/** Paleta del mapa vectorial propio (no debe parecer Google Maps). */
export const mapColors = {
  background: "#F1F0E8",
  water: "#B9D8D5",
  vegetation: "#D7E4D4",
  road: "#FFFFFF",
  roadSecondary: "#E3E5DF",
  highway: "#D8CBB8",
} as const;

export const storeCategoryColors = {
  general: "#236B4A",
  restaurant: "#B6533C",
  supermarket: "#236B4A",
  pharmacy: "#4A7C8C",
  bakery: "#D9A441",
  cafe: "#7A5A3A",
} as const;

export type StoreCategory = keyof typeof storeCategoryColors;

export const fonts = {
  display: '"Montserrat Variable", "Montserrat", system-ui, sans-serif', // títulos y botones
  body: '"Inter Variable", "Inter", system-ui, sans-serif',
} as const;

export const radii = { control: 12, card: 16, pill: 999 } as const;

export const shadows = {
  soft: "0 1px 2px rgb(32 39 36 / 0.04), 0 4px 16px rgb(32 39 36 / 0.06)",
  raised: "0 2px 4px rgb(32 39 36 / 0.05), 0 12px 32px rgb(32 39 36 / 0.10)",
} as const;

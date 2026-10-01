// Datos del panel del profesional. Todavía no hay backend de perfiles ni de solicitudes de contacto,
// así que la actividad es de ejemplo; cuando exista, `relevantItems` recibe la actividad real.

export const NAV = [
  { key: 'home', label: 'Inicio', icon: 'home' },
  { key: 'profile', label: 'Mi perfil', icon: 'user' },
  { key: 'services', label: 'Mis servicios', icon: 'briefcase' },
  { key: 'requests', label: 'Citas y solicitudes', icon: 'calendar' },
  { key: 'gallery', label: 'Galería de imágenes', icon: 'image' },
  { key: 'certificates', label: 'Certificados', icon: 'award' },
  { key: 'notifications', label: 'Notificaciones', icon: 'bell' },
  { key: 'settings', label: 'Configuración', icon: 'gear' },
];

/** Barra inferior del celular. */
export const TABS = [
  { key: 'home', label: 'Inicio', icon: 'home' },
  { key: 'services', label: 'Mis servicios', icon: 'briefcase' },
  { key: 'notifications', label: 'Notificaciones', icon: 'bell' },
  { key: 'profile', label: 'Perfil', icon: 'user' },
];

export const QUICK_ACCESS = [
  { key: 'profile', title: 'Editar perfil', text: 'Actualiza tus datos personales y de contacto.', icon: 'user', tone: 'green' },
  { key: 'requests', title: 'Gestionar citas', text: 'Revisa y administra tus solicitudes.', icon: 'calendar', tone: 'gold' },
  { key: 'gallery', title: 'Galería de servicios', text: 'Muestra tu trabajo y experiencias.', icon: 'image', tone: 'blue' },
  { key: 'certificates', title: 'Certificados', text: 'Sube y gestiona tus documentos.', icon: 'award', tone: 'terra' },
];

export const SAMPLE_ACTIVITY = { newRequests: 3, hasDescription: false, images: 0 };

/**
 * Tarjetas de "Lo más relevante para ti", según la actividad del profesional: solicitudes nuevas si hay,
 * y consejos para el perfil mientras le falte descripción o imágenes.
 */
export function relevantItems({ newRequests = 0, hasDescription = false, images = 0 }) {
  const items = [];
  if (newRequests > 0) {
    items.push({
      id: 'requests',
      kind: 'requests',
      go: 'requests',
      title: 'Nuevas solicitudes de contacto',
      text: `Tienes ${newRequests} ${newRequests === 1 ? 'mensaje' : 'mensajes'} de personas interesadas en tus servicios.`,
    });
  }
  if (!hasDescription || images === 0) {
    items.push({
      id: 'tips',
      kind: 'tips',
      go: 'profile',
      title: 'Consejos para mejorar tu perfil',
      text: 'Optimiza tu descripción y añade imágenes para atraer más clientes.',
    });
  }
  return items;
}

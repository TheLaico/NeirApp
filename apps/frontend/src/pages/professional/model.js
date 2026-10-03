// Datos del panel del profesional: menús, accesos rápidos y las tarjetas de "Lo más relevante", que se arman
// con su actividad real (solicitudes nuevas, descripción y fotos).

export const NAV = [
  { key: 'home', label: 'Inicio', icon: 'home' },
  { key: 'profile', label: 'Mi perfil', icon: 'user' },
  { key: 'services', label: 'Mis servicios', icon: 'briefcase' },
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
  { key: 'gallery', title: 'Galería de servicios', text: 'Muestra tu trabajo y experiencias.', icon: 'image', tone: 'blue' },
  { key: 'certificates', title: 'Certificados', text: 'Sube y gestiona tus documentos.', icon: 'award', tone: 'terra' },
];

/**
 * Tarjetas de "Lo más relevante para ti", según la actividad del profesional: consejos para el perfil mientras le falte descripción o imágenes.
 */
export function relevantItems({ hasDescription = false, images = 0 }) {
  const items = [];
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

import { usePersistentState } from '../../lib/usePersistentState.js';

const STORAGE_KEY = 'neirapp.frontend.professionals.directory';

// Directorio de ejemplo: todavía no hay perfiles reales de profesionales (llegan cuando exista el
// registro/perfil de profesional), así que por ahora estos mismos 3 aparecen en cualquier subcategoría.
// `featured` lo marca el admin desde "Gestión de profesionales" para que ese profesional aparezca
// primero en la lista sin importar su calificación.
const DEFAULT_PROFESSIONALS = [
  { id: 'p1', name: 'Ana Ramírez', available: true, info: '5 años de experiencia · Neira, Caldas', rating: 4.8, reviews: 12, featured: false },
  { id: 'p2', name: 'Carlos Gómez', available: false, info: '3 años de experiencia · Neira, Caldas', rating: 4.5, reviews: 8, featured: false },
  { id: 'p3', name: 'Laura Torres', available: true, info: '8 años de experiencia · Neira, Caldas', rating: 5.0, reviews: 20, featured: false },
];

/**
 * Directorio de profesionales de ejemplo. Se marca como destacado desde el admin y esta misma lista la
 * lee /profesionales — no hay backend para esto todavía, así que se guarda en localStorage (como las
 * categorías).
 */
export function useProfessionalDirectory() {
  return usePersistentState(STORAGE_KEY, DEFAULT_PROFESSIONALS);
}

// Destacados primero (sin importar su calificación); dentro de cada grupo, mejor calificado primero y,
// si empatan, el que tenga más reseñas respalda mejor ese puntaje.
export function sortProfessionals(list) {
  return [...list].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return b.rating - a.rating || b.reviews - a.reviews;
  });
}

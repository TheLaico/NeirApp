import { Brain, Calculator, Cog, Ellipsis, GraduationCap, Laptop, PawPrint, Ruler, Scale, Stethoscope } from 'lucide-react';
import { usePersistentState } from '../../lib/usePersistentState.js';

// Iconos disponibles para una categoría (los mismos que ya se usaban en /profesionales, más los que
// se puedan necesitar desde el admin). Se guarda el NOMBRE (string) en vez del componente porque esto
// vive en localStorage, así que tiene que ser serializable.
export const CATEGORY_ICONS = { Cog, Stethoscope, Scale, GraduationCap, Calculator, Brain, Ruler, Laptop, PawPrint, Ellipsis };
export const ICON_NAMES = Object.keys(CATEGORY_ICONS);

const STORAGE_KEY = 'neirapp.frontend.professionals.categories';

// Color de una subcategoría que todavía no tiene uno propio asignado (datos viejos guardados antes de
// que existiera este campo, o categorías vacías).
export const DEFAULT_SUBCATEGORY_COLOR = '#0f5238';

// Ilustración de portada por categoría, para el encabezado de /profesionales/categoria (misma idea que
// el fondo de la portada de /profesionales). Va por `id` y no en los datos editables por el admin,
// porque todavía no están todas las imágenes: si una categoría no aparece acá, o su archivo no existe
// en assets/professionals, esa página simplemente se ve sin ilustración (sigue viéndose prolija).
export const CATEGORY_IMAGE_KEYS = {
  ingenierias: 'engineering',
  medicina: 'medicine',
  derecho: 'derecho',
};

// Semilla inicial: las mismas 10 categorías que ya existían en la página, ahora con algunas
// subcategorías/carreras de ejemplo (editables luego desde "Gestión de profesionales" en el admin).
// Cada subcategoría arranca con el color de su categoría; el admin puede darle uno propio a cada una.
const DEFAULT_CATEGORIES = [
  {
    id: 'ingenierias', label: 'Ingenierías', icon: 'Cog', color: '#E8A92C',
    subcategories: [
      { id: 'ing-civil', label: 'Ingeniería Civil', color: '#E8A92C' },
      { id: 'ing-sistemas', label: 'Ingeniería de Sistemas', color: '#E8A92C' },
      { id: 'ing-industrial', label: 'Ingeniería Industrial', color: '#E8A92C' },
      { id: 'ing-ambiental', label: 'Ingeniería Ambiental', color: '#E8A92C' },
    ],
  },
  {
    id: 'medicina', label: 'Medicina', icon: 'Stethoscope', color: '#B6533C',
    subcategories: [
      { id: 'medicina-general', label: 'Medicina general', color: '#B6533C' },
      { id: 'pediatria', label: 'Pediatría', color: '#B6533C' },
      { id: 'odontologia', label: 'Odontología', color: '#B6533C' },
      { id: 'fisioterapia', label: 'Fisioterapia', color: '#B6533C' },
    ],
  },
  {
    id: 'derecho', label: 'Derecho', icon: 'Scale', color: '#2C5F8A',
    subcategories: [
      { id: 'derecho-civil', label: 'Derecho civil', color: '#2C5F8A' },
      { id: 'derecho-penal', label: 'Derecho penal', color: '#2C5F8A' },
      { id: 'derecho-laboral', label: 'Derecho laboral', color: '#2C5F8A' },
    ],
  },
  {
    id: 'educacion', label: 'Educación', icon: 'GraduationCap', color: '#D97706',
    subcategories: [
      { id: 'docencia', label: 'Docencia', color: '#D97706' },
      { id: 'tutorias', label: 'Tutorías', color: '#D97706' },
      { id: 'educacion-especial', label: 'Educación especial', color: '#D97706' },
    ],
  },
  {
    id: 'contabilidad', label: 'Contabilidad', icon: 'Calculator', color: '#1D8A9C',
    subcategories: [
      { id: 'contador-publico', label: 'Contador público', color: '#1D8A9C' },
      { id: 'auditoria', label: 'Auditoría', color: '#1D8A9C' },
      { id: 'asesoria-tributaria', label: 'Asesoría tributaria', color: '#1D8A9C' },
    ],
  },
  {
    id: 'psicologia', label: 'Psicología', icon: 'Brain', color: '#C0587A',
    subcategories: [
      { id: 'psicologia-clinica', label: 'Psicología clínica', color: '#C0587A' },
      { id: 'psicologia-infantil', label: 'Psicología infantil', color: '#C0587A' },
      { id: 'terapia-pareja', label: 'Terapia de pareja', color: '#C0587A' },
    ],
  },
  {
    id: 'arquitectura', label: 'Arquitectura', icon: 'Ruler', color: '#6A4C93',
    subcategories: [
      { id: 'arquitectura-residencial', label: 'Arquitectura residencial', color: '#6A4C93' },
      { id: 'diseno-interiores', label: 'Diseño de interiores', color: '#6A4C93' },
      { id: 'urbanismo', label: 'Urbanismo', color: '#6A4C93' },
    ],
  },
  {
    id: 'tecnologia', label: 'Tecnología', icon: 'Laptop', color: '#3B6E8F',
    subcategories: [
      { id: 'desarrollo-software', label: 'Desarrollo de software', color: '#3B6E8F' },
      { id: 'soporte-tecnico', label: 'Soporte técnico', color: '#3B6E8F' },
      { id: 'diseno-grafico', label: 'Diseño gráfico', color: '#3B6E8F' },
    ],
  },
  {
    id: 'veterinaria', label: 'Veterinaria', icon: 'PawPrint', color: '#2D7A3D',
    subcategories: [
      { id: 'veterinaria-general', label: 'Veterinaria general', color: '#2D7A3D' },
      { id: 'peluqueria-canina', label: 'Peluquería canina', color: '#2D7A3D' },
      { id: 'cirugia-veterinaria', label: 'Cirugía veterinaria', color: '#2D7A3D' },
    ],
  },
  { id: 'otros', label: 'Otros', icon: 'Ellipsis', color: '#6b7a70', subcategories: [] },
];

/**
 * Categorías y subcategorías de /profesionales. Se editan desde el admin ("Gestión de profesionales")
 * y esta misma página las lee, ambas a través de este hook — no hay backend para esto todavía, así que
 * se guardan en localStorage (como `buildingsPref` en el mapa); los cambios quedan en este navegador.
 */
export function useProfessionalCategories() {
  return usePersistentState(STORAGE_KEY, DEFAULT_CATEGORIES);
}

export function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

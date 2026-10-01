import { Brain, Calculator, Cog, Ellipsis, GraduationCap, Laptop, PawPrint, Ruler, Scale, Stethoscope } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { professionalsApi } from './api.js';

// Iconos disponibles para una categoría. La API guarda el NOMBRE (string) y solo acepta estos mismos
// (ver `ICONS` en apps/api/.../professionals/domain/categories.py).
export const CATEGORY_ICONS = { Cog, Stethoscope, Scale, GraduationCap, Calculator, Brain, Ruler, Laptop, PawPrint, Ellipsis };
export const ICON_NAMES = Object.keys(CATEGORY_ICONS);

// Color sugerido para una subcategoría nueva (y respaldo si alguna llegara sin color).
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

// Última lista recibida, compartida entre pantallas: al volver a una página se muestra al instante
// mientras se pide de nuevo a la API.
let cached = null;

/**
 * Categorías y subcategorías de /profesionales desde la API (las gestiona el admin en "Gestión de
 * profesionales"; la migración 0022 carga las 10 iniciales). `reload()` vuelve a pedirlas.
 */
export function useProfessionalCategories() {
  const [state, setState] = useState({ categories: cached ?? [], loading: !cached, error: '' });

  const reload = useCallback(async () => {
    try {
      cached = await professionalsApi.categories();
      setState({ categories: cached, loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}

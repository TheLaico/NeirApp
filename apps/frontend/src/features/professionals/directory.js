import { useCallback, useEffect, useState } from 'react';
import { professionalsApi } from './api.js';

/** Un perfil de la API, con los nombres que usan las tarjetas del directorio. */
export const toCard = (p) => ({
  id: p.user_id,
  name: p.display_name,
  photo: p.photo_url,
  available: p.is_available,
  featured: p.is_featured,
  headline: p.headline,
  categoryId: p.category_id,
  subcategoryId: p.subcategory_id,
  experienceYears: p.experience_years,
  phone: p.phone,
  whatsapp: p.whatsapp || p.phone,
});

/**
 * Directorio de profesionales desde la API (destacados primero, luego los disponibles: el orden lo da el
 * servidor). Solo aparecen los que tienen acceso de profesional y ya llenaron su perfil.
 */
export function useProfessionalDirectory({ categoryId, subcategoryId } = {}) {
  const [state, setState] = useState({ list: [], loading: true, error: '' });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await professionalsApi.list({ categoryId, subcategoryId });
      setState({ list: data.map(toCard), loading: false, error: '' });
    } catch (err) {
      setState({ list: [], loading: false, error: err.message });
    }
  }, [categoryId, subcategoryId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload, setList: (list) => setState((s) => ({ ...s, list })) };
}

/** Enlaces para contactar: llamada y chat de WhatsApp (los celulares se guardan sin el +57). */
export const telLink = (phone) => `tel:+57${phone}`;
export const whatsappLink = (phone, text = 'Hola, te encontré en NeirAPP.') => `https://wa.me/57${phone}?text=${encodeURIComponent(text)}`;

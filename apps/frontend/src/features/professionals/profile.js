import { useCallback, useEffect, useState } from 'react';
import { professionalsApi } from './api.js';

// Perfil que arma el propio profesional desde "Mi perfil". Se guarda en la API (`PUT /professionals/me`)
// y se publica en el directorio de /profesionales mientras la cuenta tenga acceso de profesional.

export const TITLES = ['', 'Dr.', 'Dra.', 'Ing.', 'Abg.', 'Arq.', 'Lic.', 'Psic.', 'Cont.'];

export const MODALITIES = [
  { key: 'office', label: 'En consultorio u oficina' },
  { key: 'home', label: 'A domicilio' },
  { key: 'online', label: 'Virtual' },
];

export const DESCRIPTION_MAX = 600;

export const emptyProfile = (user) => ({
  photo: '',
  title: '',
  fullName: user?.name ?? '',
  headline: '',
  categoryId: '',
  subcategoryId: '',
  experienceYears: '',
  description: '',
  phone: user?.phone ?? '',
  whatsapp: user?.phone ?? '',
  email: user?.email ?? '',
  address: '',
  schedule: '',
  modalities: { office: true, home: false, online: false },
  available: true,
  listed: true,
  acceptsRequests: true,
});

/** De la respuesta de la API al borrador del formulario. */
export const fromApi = (p) => ({
  photo: p.photo_url,
  title: p.title,
  fullName: p.full_name,
  headline: p.headline,
  categoryId: p.category_id,
  subcategoryId: p.subcategory_id,
  experienceYears: p.experience_years ?? '',
  description: p.description,
  phone: p.phone,
  whatsapp: p.whatsapp,
  email: p.email,
  address: p.address,
  schedule: p.schedule,
  modalities: { ...p.modalities },
  available: p.is_available,
  // Ajustes de "Configuración": no los envía `toApi`, se guardan aparte con `saveSettings`.
  listed: p.is_listed,
  acceptsRequests: p.accepts_requests,
});

export const toApi = (d) => ({
  photo_url: d.photo,
  title: d.title,
  full_name: d.fullName.trim(),
  headline: d.headline,
  category_id: d.categoryId,
  subcategory_id: d.subcategoryId,
  experience_years: d.experienceYears === '' ? null : Number(d.experienceYears),
  description: d.description,
  phone: d.phone,
  whatsapp: d.whatsapp,
  email: d.email.trim(),
  address: d.address,
  schedule: d.schedule,
  modalities: d.modalities,
  is_available: d.available,
});

// Errores de la API → campo del formulario donde se muestran.
const ERROR_FIELDS = {
  invalid_full_name: 'fullName',
  invalid_title: 'title',
  invalid_category: 'categoryId',
  invalid_experience: 'experienceYears',
  invalid_phone: 'phone',
  invalid_contact_email: 'email',
  no_modality: 'modalities',
  invalid_photo_url: 'photo',
};
export const fieldForError = (code) => ERROR_FIELDS[code];

/**
 * Perfil del profesional desde la API. Si todavía no lo ha creado (404), arranca con su nombre, celular y correo
 * de la cuenta; `exists` indica si ya está publicado. `save(draft)` lo guarda y devuelve el perfil actualizado.
 */
export function useProfessionalProfile(user) {
  const [state, setState] = useState({ profile: null, exists: false, loading: true, error: '' });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      setState({ profile: fromApi(await professionalsApi.mine()), exists: true, loading: false, error: '' });
    } catch (err) {
      if (err.status === 404) setState({ profile: emptyProfile(user), exists: false, loading: false, error: '' });
      else setState((s) => ({ ...s, loading: false, error: err.message }));
    }
    // Depende solo del id: no hace falta recargar si cambian otros datos de la cuenta.
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (draft) => {
    const profile = fromApi(await professionalsApi.saveMine(toApi(draft)));
    setState({ profile, exists: true, loading: false, error: '' });
    return profile;
  }, []);

  // Mostrar u ocultar el perfil y aceptar o pausar solicitudes ({ listed, acceptsRequests }).
  const saveSettings = useCallback(async ({ listed, acceptsRequests }) => {
    const profile = fromApi(await professionalsApi.saveSettings({ is_listed: listed, accepts_requests: acceptsRequests }));
    setState({ profile, exists: true, loading: false, error: '' });
    return profile;
  }, []);

  return { ...state, reload: load, save, saveSettings };
}

/** Nombre como lo ven los clientes: "Dr. Andrés Patiño". */
export const displayName = (profile) => [profile.title, profile.fullName.trim()].filter(Boolean).join(' ');

const digits = (s) => (s ?? '').replace(/\D/g, '');

/** Celular colombiano: 10 dígitos que empiezan por 3 (se aceptan espacios y el +57). */
export function isMobile(value) {
  const d = digits(value).replace(/^57(?=\d{10}$)/, '');
  return /^3\d{9}$/.test(d);
}

/** Errores por campo; vacío si se puede guardar. */
export function validateProfile(p) {
  const errors = {};
  if (p.fullName.trim().length < 3) errors.fullName = 'Escribe tu nombre completo.';
  if (!p.categoryId) errors.categoryId = 'Elige tu área.';
  if (p.experienceYears !== '' && !(Number(p.experienceYears) >= 0 && Number(p.experienceYears) <= 70)) {
    errors.experienceYears = 'Escribe un número entre 0 y 70.';
  }
  if (!isMobile(p.phone)) errors.phone = 'Escribe un celular de 10 dígitos, por ejemplo 310 123 4567.';
  if (p.whatsapp && !isMobile(p.whatsapp)) errors.whatsapp = 'Escribe un número de WhatsApp de 10 dígitos.';
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) errors.email = 'Revisa el correo.';
  if (!Object.values(p.modalities).some(Boolean)) errors.modalities = 'Elige al menos una forma de atender.';
  return errors;
}

/** Lo que le falta al perfil para verse completo ante los clientes (en orden de importancia). */
export function missingItems(p) {
  const items = [];
  if (!p.photo) items.push({ field: 'photo', label: 'Agrega una foto tuya' });
  if (!p.subcategoryId && !p.headline.trim()) items.push({ field: 'subcategoryId', label: 'Indica tu especialidad' });
  if (p.description.trim().length < 80) items.push({ field: 'description', label: 'Escribe una descripción de al menos 80 caracteres' });
  if (!p.address.trim() && p.modalities.office) items.push({ field: 'address', label: 'Agrega la dirección de tu consultorio' });
  if (!p.schedule.trim()) items.push({ field: 'schedule', label: 'Cuenta tu horario de atención' });
  return items;
}

import { usePersistentState } from '../../lib/usePersistentState.js';

// Perfil que arma el propio profesional desde "Mi perfil". Todavía no hay backend de perfiles, así que se
// guarda en este navegador (una clave por usuario); la foto sí se sube a la API de imágenes.

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
});

export function useProfessionalProfile(user) {
  return usePersistentState(`neirapp.frontend.professional.profile.${user?.id ?? 'anon'}`, () => emptyProfile(user));
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

import { Briefcase, Home, Monitor } from 'lucide-react';

// Solicitudes de cita a profesionales. Mismos valores que la API
// (apps/api/.../professionals/domain/appointments.py).

export const MODALITIES = {
  office: { label: 'En consultorio u oficina', short: 'Consultorio', Icon: Briefcase },
  home: { label: 'A domicilio', short: 'A domicilio', Icon: Home },
  online: { label: 'Virtual', short: 'Virtual', Icon: Monitor },
};

export const TIME_SLOTS = [
  { key: 'any', label: 'Cualquier hora' },
  { key: 'morning', label: 'Mañana (7 a 12)' },
  { key: 'afternoon', label: 'Tarde (12 a 6)' },
  { key: 'evening', label: 'Noche (6 a 9)' },
];
export const slotLabel = (key) => TIME_SLOTS.find((s) => s.key === key)?.label ?? '';

export const REQUEST_STATUS = {
  pending: { label: 'Esperando respuesta', short: 'Nueva', tone: 'pending' },
  scheduled: { label: 'Cita agendada', short: 'Agendada', tone: 'scheduled' },
  rejected: { label: 'No aceptada', short: 'Rechazada', tone: 'rejected' },
  cancelled: { label: 'Cancelada', short: 'Cancelada', tone: 'cancelled' },
  completed: { label: 'Atendida', short: 'Atendida', tone: 'completed' },
};

export const MESSAGE_MAX = 500;

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** "jueves 10 de octubre" (fecha sin hora, como la guarda la API: "2026-10-10"). */
export function dayLabel(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "Jueves 10 de octubre, 3:00 p. m." en la hora de este dispositivo. */
export function dateTimeLabel(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const day = date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = date.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  return capitalize(`${day}, ${time}`);
}

/** "Hace 5 min", "Hace 3 h", "Ayer", "12 sept." */
export function sinceLabel(iso) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  if (hours < 48) return 'Ayer';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

/** Fecha de hoy en este dispositivo como "AAAA-MM-DD" (para el mínimo de los selectores de fecha). */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fecha "AAAA-MM-DD" y hora "HH:MM" locales -> ISO con la zona horaria del dispositivo (la API exige zona). */
export function localToIso(date, time) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

/** Para precargar los selectores al reprogramar: ISO -> { date, time } locales. */
export function isoToLocal(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

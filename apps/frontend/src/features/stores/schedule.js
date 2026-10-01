// Horario de las tiendas. El servidor trabaja en hora de Colombia (UTC-5), y aquí se muestra igual.

const TZ = 'America/Bogota';

/** Días en el orden del servidor: 0 = lunes … 6 = domingo. */
export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Hora que devuelve el servidor ("08:00:00") o la de un campo de hora ("08:00") → "8:00 a. m.". */
export function formatTime(value) {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  const suffix = h >= 12 ? 'p. m.' : 'a. m.';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "08:00:00" → "08:00", para los campos de hora. */
export const toInputTime = (value) => (value ? value.slice(0, 5) : '');

/** Hoy en Colombia como "AAAA-MM-DD". */
export const todayInBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

const dayNumber = (isoDay) => Math.round(new Date(`${isoDay}T00:00:00Z`).getTime() / 86_400_000);

/** Fecha "AAAA-MM-DD" → "vie 25 sep 2026". */
export function formatDay(isoDay) {
  return new Date(`${isoDay}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
}

/** Cuándo abre la tienda ("hoy a las 8:00 a. m.", "mañana…", "el jueves…"), a partir del momento que da el servidor. */
export function nextOpenText(nextOpenAt) {
  if (!nextOpenAt) return '';
  const opens = new Date(nextOpenAt);
  const day = opens.toLocaleDateString('en-CA', { timeZone: TZ });
  const time = opens.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const diff = dayNumber(day) - dayNumber(todayInBogota());
  const when = diff <= 0 ? 'hoy' : diff === 1 ? 'mañana' : `el ${DAYS[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7].toLowerCase()}`;
  return `${when} a las ${formatTime(time)}`; // termina en "a. m." o "p. m.": no agregues otro punto
}

/** Por qué está cerrada la tienda, dicho para el comerciante. */
export const CLOSED_REASON = {
  manual: 'La tienda está cerrada con el interruptor.',
  closed_date: 'Hoy marcaste que no abres.',
  day_off: 'Hoy es un día en que no abres, según tu horario.',
  outside_hours: 'Ahora estás fuera de tu horario de atención.',
};

/** Lo mismo, pensado para el cliente. */
export const CLOSED_REASON_CUSTOMER = {
  manual: 'Cerrada por ahora',
  closed_date: 'Hoy no abre',
  day_off: 'Hoy no abre',
  outside_hours: 'Fuera de horario',
};

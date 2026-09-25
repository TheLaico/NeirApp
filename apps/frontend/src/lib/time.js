const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

const UNITS = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "hace 5 minutos", "ayer"… a partir de una fecha ISO. */
export function timeAgo(iso) {
  const diff = new Date(iso).getTime() - Date.now();
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return 'hace un momento';
}

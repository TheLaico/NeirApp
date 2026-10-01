// ¿Es de noche ahora mismo? Regla simple por franja horaria (no salida/puesta de sol exacta): entre las
// 6 p.m. y las 6 a.m. Neira ya está oscuro casi todo el año, al estar tan cerca del ecuador.
export function isNightTime(date = new Date()) {
  const hour = date.getHours();
  return hour >= 18 || hour < 6;
}

/** Tema del mapa según la preferencia del usuario: si no la activó, siempre es de día. */
export function mapThemeFor(nightAutoEnabled, date = new Date()) {
  return nightAutoEnabled && isNightTime(date) ? 'night' : 'day';
}

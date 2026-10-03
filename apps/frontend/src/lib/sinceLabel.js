/** "Hace 5 min", "Hace 3 h", "Ayer", "12 sept." (para la hora de los avisos). */
export function sinceLabel(iso) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  if (hours < 48) return 'Ayer';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

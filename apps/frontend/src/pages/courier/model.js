import { formatCop } from '../../lib/money.js';

// Datos ya cargados del repartidor → lo que muestran el Resumen, los avisos y el historial.

const at = (iso) => new Date(iso).getTime();
export const shortCode = (id) => id.slice(0, 6).toUpperCase();
export const clock = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
export { formatCop };

/** Estado de una entrega, con el color de su etiqueta (mismas etiquetas del panel del comerciante). */
export const DELIVERY_STATUS = {
  assigned: { label: 'En curso', tone: 'prep' },
  delivered: { label: 'Entregado', tone: 'done' },
  cancelled: { label: 'Cancelado', tone: 'bad' },
};

/** Estado de la tienda dentro de un pedido disponible. */
export const STORE_STATUS = { accepted: 'Aceptado', preparing: 'Preparando', ready: 'Listo para recoger' };

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Lo que ganó cada entrega: los créditos de la billetera guardan el id de la entrega como referencia. */
export function earningsByDelivery(ledger) {
  const map = new Map();
  for (const e of ledger ?? []) if (e.type === 'credit' && e.reference_id) map.set(e.reference_id, e.amount_cop);
  return map;
}

/** Cifras de hoy: entregas completadas, lo ganado y el saldo de la billetera. */
export function todayStats(history, ledger, balance) {
  const start = startOfToday();
  const delivered = (history ?? []).filter((d) => d.status === 'delivered' && at(d.delivered_at ?? d.updated_at) >= start);
  const earned = (ledger ?? []).filter((e) => e.type === 'credit' && at(e.created_at) >= start).reduce((sum, e) => sum + e.amount_cop, 0);
  return { deliveries: delivered.length, earned, balance: balance ?? 0 };
}

/** Pedidos disponibles que coinciden con lo escrito en el buscador (código, tienda o nota de entrega). */
export function availableMatches(order, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return shortCode(order.order_id).toLowerCase().includes(q) || order.delivery_notes.toLowerCase().includes(q) || order.stops.some((s) => s.store_name.toLowerCase().includes(q));
}

/** Avisos armados con lo que ya pasó: pedidos por tomar, pagos recibidos y entregas. Del más reciente al más viejo. */
export function buildNotifications(available, history, ledger, active) {
  const events = [];
  for (const stop of active?.stops ?? []) {
    if (stop.is_ready && !stop.is_picked_up) events.push({ id: `ready-${stop.store_order_id}`, kind: 'order', at: new Date().toISOString(), title: '¡Pedido listo para recoger!', text: `${stop.store_name} ya tiene el pedido listo.` });
  }
  if ((available ?? []).length > 0) {
    const n = available.length;
    events.push({ id: 'available', kind: 'order', at: new Date().toISOString(), title: n === 1 ? 'Hay 1 pedido por tomar' : `Hay ${n} pedidos por tomar`, text: 'Acéptalos antes de que los tome otro repartidor.' });
  }
  for (const e of ledger ?? []) {
    if (e.type === 'credit') events.push({ id: `p-${e.id}`, kind: 'pay', at: e.created_at, title: 'Pago recibido', text: `Ganaste ${formatCop(e.amount_cop)} por una entrega.` });
    else events.push({ id: `w-${e.id}`, kind: 'route', at: e.created_at, title: 'Retiro solicitado', text: `Pediste retirar ${formatCop(e.amount_cop)} de tu billetera.` });
  }
  for (const d of history ?? []) {
    if (d.status === 'cancelled') events.push({ id: `c-${d.id}`, kind: 'bad', at: d.updated_at, title: 'Entrega cancelada', text: `Cancelaste el pedido #${shortCode(d.order_id)}.` });
  }
  return events.sort((a, b) => at(b.at) - at(a.at));
}

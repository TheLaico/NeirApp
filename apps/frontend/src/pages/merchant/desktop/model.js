import { isNew } from '../../../features/merchant/api.js';
import { formatCop } from '../../../lib/money.js';

const at = (iso) => new Date(iso).getTime();
export const shortCode = (id) => id.slice(0, 6).toUpperCase();

/** Estado del pedido dicho para el comercio, con el color de su etiqueta. */
export const ORDER_STATUS = {
  paid: { label: 'Nuevo', tone: 'new' },
  accepted: { label: 'Aceptado', tone: 'prep' },
  preparing: { label: 'En preparación', tone: 'prep' },
  ready: { label: 'Listo', tone: 'ready' },
  handed_over: { label: 'Entregado', tone: 'done' },
  rejected: { label: 'Rechazado', tone: 'bad' },
};

export const clock = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
export const longDate = (date = new Date()) => date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');

const units = (order) => order.lines.reduce((total, l) => total + l.quantity, 0);
export const productsText = (order) => `${units(order)} ${units(order) === 1 ? 'producto' : 'productos'}`;

/** ¿El pedido coincide con lo que se escribió en el buscador? (código, producto o estado) */
export function orderMatches(order, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    shortCode(order.order_id).toLowerCase().includes(q) ||
    (ORDER_STATUS[order.status]?.label ?? '').toLowerCase().includes(q) ||
    order.lines.some((l) => l.name.toLowerCase().includes(q))
  );
}

/** Pedidos de los que ya se puede hablar (los que se están pagando no llegaron a la tienda), del más nuevo al más viejo. */
export const recentOrders = (orders) =>
  [...(orders ?? [])].filter((o) => o.status !== 'pending_payment').sort((a, b) => at(b.created_at) - at(a.created_at));

/** Cifras de hoy: pedidos recibidos, ventas (pedidos ya entregados al repartidor) y calificación promedio. */
export function todayStats(orders, rating) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const todays = recentOrders(orders).filter((o) => at(o.created_at) >= start.getTime());
  const sales = todays.filter((o) => o.status === 'handed_over').reduce((total, o) => total + o.subtotal_cop, 0);
  return { received: todays.length, sales, average: rating?.count ? rating.average : null };
}

/** Avisos armados con lo que ya pasó: pedidos nuevos, entregas y calificaciones, del más reciente al más viejo. */
export function buildNotifications(orders, reviews) {
  const events = [];
  for (const o of recentOrders(orders)) {
    const code = `#${shortCode(o.order_id)}`;
    if (isNew(o)) {
      events.push({ id: `n-${o.id}`, kind: 'order', at: o.created_at, title: `Nuevo pedido ${code}`, text: `El cliente ha realizado un pedido por ${formatCop(o.subtotal_cop)}.` });
    } else if (o.status === 'handed_over') {
      events.push({ id: `d-${o.id}`, kind: 'route', at: o.updated_at, title: 'Pedido en camino', text: `El pedido ${code} ya está en camino para el cliente.` });
    } else if (o.status === 'rejected') {
      events.push({ id: `r-${o.id}`, kind: 'bad', at: o.updated_at, title: 'Pedido rechazado', text: `Rechazaste el pedido ${code}${o.rejection_reason ? `: ${o.rejection_reason}` : '.'}` });
    }
  }
  for (const r of reviews ?? []) {
    events.push({
      id: `v-${r.id}`,
      kind: 'review',
      at: r.created_at,
      title: 'Nueva calificación',
      text: `El cliente dejó una calificación de ${r.rating} ${r.rating === 1 ? 'estrella' : 'estrellas'} en tu tienda.`,
    });
  }
  return events.sort((a, b) => at(b.at) - at(a.at));
}

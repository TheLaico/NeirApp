import { shortId } from './api.js';

// Seguimiento de pedidos: compara lo que había la última vez con lo de ahora y arma los avisos para el cliente.
// Es una función pura (sin red ni estado) para poder probarla.

const STORE_STEPS = {
  accepted: (store, code) => ({
    kind: 'order',
    title: 'Pedido aceptado',
    body: `${store} confirmó tu pedido #${code} y en breve comenzará a prepararlo.`,
  }),
  preparing: (store, code) => ({
    kind: 'order',
    title: 'Pedido en preparación',
    body: `${store} está preparando tu pedido #${code}.`,
  }),
  ready: (store, code) => ({
    kind: 'order',
    title: 'Tu pedido está listo',
    body: `${store} tiene tu pedido #${code} listo. El repartidor lo recogerá en breve.`,
  }),
};

/** Lo que interesa recordar de un pedido para detectar cambios: estado de cada tienda y avance de la entrega. */
export function snapshotOf(order, delivery) {
  return {
    stores: Object.fromEntries(order.store_orders.map((so) => [so.id, so.status])),
    delivery: delivery?.status ?? null, // 'assigned' | 'delivered' | 'cancelled' | null
    picked: delivery?.stops_picked_up ?? 0,
    total: delivery?.stops_total ?? 0,
  };
}

/** ¿Ya terminó todo? Entonces no hace falta seguir consultando su entrega. */
export function isFinished(snapshot) {
  const statuses = Object.values(snapshot.stores);
  return snapshot.delivery === 'delivered' || (statuses.length > 0 && statuses.every((s) => s === 'rejected'));
}

/**
 * Avisos nuevos entre `prev` y el estado actual del pedido. Sin `prev` (primera vez que se ve el pedido) no
 * avisa nada: solo queda como punto de partida. Cada aviso trae un `id` estable para no repetirlo.
 */
export function describeChanges(prev, order, delivery, now = new Date()) {
  if (!prev) return [];
  const code = shortId(order.id);
  const cur = snapshotOf(order, delivery);
  const at = now.toISOString();
  const notices = [];
  const push = (key, notice) => notices.push({ id: `ord-${order.id}-${key}`, createdAt: at, read: false, ...notice });

  // Estado de cada tienda del pedido
  for (const so of order.store_orders) {
    const before = prev.stores[so.id];
    if (before === so.status) continue;
    if (so.status === 'rejected') {
      const reason = so.rejection_reason ? ` Motivo: ${so.rejection_reason}` : '';
      push(`${so.id}-rejected`, { kind: 'order', title: 'Pedido no aceptado', body: `${so.store_name} no pudo aceptar tu pedido #${code}.${reason}` });
    } else if (STORE_STEPS[so.status]) {
      push(`${so.id}-${so.status}`, STORE_STEPS[so.status](so.store_name, code));
    }
  }

  // Repartidor y recogidas
  if (cur.delivery === 'assigned' && prev.delivery !== 'assigned') {
    push('courier-assigned', { kind: 'delivery', title: 'Repartidor asignado', body: `Un repartidor tomó tu pedido #${code} y se dirige a recogerlo.` });
  }
  if (cur.delivery === 'assigned' && cur.picked > prev.picked) {
    if (cur.picked < cur.total) {
      push(`picked-${cur.picked}`, {
        kind: 'delivery',
        title: 'Pedido recogido',
        body: `El repartidor recogió ${cur.picked} de ${cur.total} pedidos de tu compra #${code} y se dirige a recoger los demás.`,
      });
    } else {
      push('picked-all', {
        kind: 'delivery',
        title: 'Tu pedido va en camino',
        body: `El repartidor recogió tu pedido #${code} y se dirige a tu domicilio. Mantente atento y ten a la mano tu código de entrega.`,
      });
    }
  }
  if (cur.delivery === 'delivered' && prev.delivery !== 'delivered') {
    push('delivered', { kind: 'done', title: 'Pedido entregado', body: `Tu pedido #${code} fue entregado. Gracias por comprar en NeirAPP; cuéntanos cómo te fue calificando tu experiencia.` });
  }
  if (prev.delivery === 'assigned' && (cur.delivery === null || cur.delivery === 'cancelled')) {
    push(`reassign-${Date.now()}`, { kind: 'delivery', title: 'Buscando nuevo repartidor', body: `El repartidor no pudo continuar con tu pedido #${code}. Ya estamos asignando otro para que llegue lo antes posible.` });
  }
  return notices;
}

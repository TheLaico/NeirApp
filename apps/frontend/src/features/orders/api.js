import { authRequest } from '../../services/auth.js';

const API = '/api/v1';

// Pedidos del cliente (módulo `ordering`) y el código de entrega (módulo `dispatch`).
export const ordersApi = {
  // Crea el pedido sin pagar; la tienda no lo ve hasta que se paga.
  create: (body) => authRequest(`${API}/orders`, { method: 'POST', body }),
  // Marca el pedido como pagado: desde ese momento le llega a cada tienda.
  pay: (orderId) => authRequest(`${API}/orders/${orderId}/pay`, { method: 'POST' }),
  list: () => authRequest(`${API}/orders`),
  // Código que el cliente le da al repartidor al recibir. Devuelve null si todavía no hay repartidor.
  delivery: (orderId) => authRequest(`${API}/deliveries/by-order/${orderId}`),
};

// Calificación privada al repartidor de un pedido entregado (solo la ve el administrador).
ordersApi.rateCourier = (orderId, rating, comment) =>
  authRequest(`${API}/deliveries/by-order/${orderId}/rating`, { method: 'POST', body: { rating, comment: comment || null } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isServerId = (id) => typeof id === 'string' && UUID.test(id);

/** Código corto con el que el cliente identifica su pedido (los primeros caracteres del id). */
export const shortId = (id) => id.slice(0, 6).toUpperCase();

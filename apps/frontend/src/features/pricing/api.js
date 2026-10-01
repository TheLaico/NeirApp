import { authRequest } from '../../services/auth.js';

const API = '/api/v1';

// Tarifa de envío (módulo `pricing`): la lee cualquiera antes de pagar; solo el admin la cambia.
export const pricingApi = {
  delivery: () => authRequest(`${API}/pricing/delivery`),
  update: (deliveryFeeCop, courierSharePercent) =>
    authRequest(`${API}/pricing/delivery`, { method: 'PUT', body: { delivery_fee_cop: deliveryFeeCop, courier_share_percent: courierSharePercent } }),
  // Lo acumulado por envíos entregados: repartidores y plataforma (solo admin).
  earnings: () => authRequest(`${API}/deliveries/earnings-summary`),
};

/** Reparto de un valor de envío según el porcentaje del repartidor (igual que en el servidor: el redondeo sobrante es de la plataforma). */
export function splitFee(feeCop, courierPercent) {
  const courier = Math.floor((feeCop * courierPercent) / 100);
  return { courier, platform: feeCop - courier };
}

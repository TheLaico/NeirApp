import { useCallback, useEffect, useRef, useState } from 'react';
import { authRequest } from '../../services/auth.js';

const API = '/api/v1';

// Endpoints de repartidor (módulo `dispatch` del backend).
export const courierApi = {
  profile: () => authRequest(`${API}/couriers/me`),
  // Tipos de vehículo y si están habilitados; el admin los gestiona desde su panel.
  vehicleTypes: () => authRequest(`${API}/couriers/vehicle-types`),
  setVehicleType: (type, isEnabled) =>
    authRequest(`${API}/couriers/vehicle-types/${type}`, { method: 'PUT', body: { is_enabled: isEnabled } }),
  createProfile: (body) => authRequest(`${API}/couriers/me`, { method: 'POST', body }),
  available: () => authRequest(`${API}/deliveries/available`),
  claim: (orderId) => authRequest(`${API}/deliveries/${orderId}/claim`, { method: 'POST' }),
  active: () => authRequest(`${API}/deliveries/mine/active`),
  history: () => authRequest(`${API}/deliveries/mine/history`),
  // El código lo entrega el cliente al repartidor cuando este llega con el pedido.
  confirmDelivery: (deliveryId, code) =>
    authRequest(`${API}/deliveries/${deliveryId}/confirm-delivery`, { method: 'POST', body: { code } }),
  // Calificaciones privadas de los clientes a los repartidores (solo administrador).
  // Mapa en vivo: el repartidor reporta su posición; el administrador ve la de todos.
  sendLocation: (lat, lng, heading) => authRequest(`${API}/couriers/me/location`, { method: 'PUT', body: { lat, lng, heading } }),
  live: () => authRequest(`${API}/couriers/live`),
  ratings: () => authRequest(`${API}/deliveries/courier-ratings`),
  cancel: (deliveryId) => authRequest(`${API}/deliveries/${deliveryId}/cancel`, { method: 'POST' }),
};

// Billetera del repartidor (módulo `wallet`): cada entrega completada le acredita su ganancia.
export const walletApi = {
  balance: () => authRequest(`${API}/wallet/balance`),
  ledger: () => authRequest(`${API}/wallet/ledger`),
  withdraw: (amountCop) => authRequest(`${API}/wallet/withdrawals`, { method: 'POST', body: { amount_cop: amountCop } }),
};

export const VEHICLES = [
  { value: 'motorcycle', label: 'Moto' },
  { value: 'motocarro', label: 'Motocarro' },
  { value: 'bike', label: 'Bicicleta' },
  { value: 'car', label: 'Carro' },
];

export const vehicleLabel = (type) => VEHICLES.find((v) => v.value === type)?.label ?? type;

/** Enlace para abrir una ubicación en el mapa del teléfono. */
export const mapsUrl = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

/**
 * Carga `load()` al montar y la repite cada `every` ms (0 = sin repetir). `refresh()` recarga a mano.
 * Con `enabled: false` no hace nada. Los errores de una recarga no borran los datos ya mostrados.
 */
export function usePolled(load, { every = 0, enabled = true } = {}) {
  const [state, setState] = useState({ data: undefined, error: '', loading: true });
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    try {
      const data = await loadRef.current();
      setState({ data, error: '', loading: false });
      return data;
    } catch (err) {
      setState((s) => ({ ...s, error: err.message, loading: false }));
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    if (!every) return undefined;
    const id = setInterval(() => {
      if (!document.hidden) refresh();
    }, every);
    return () => clearInterval(id);
  }, [enabled, every, refresh]);

  return { ...state, refresh };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { authRequest, getAccessToken } from '../../services/auth.js';
import { usePolled } from '../courier/api.js';

const API = '/api/v1';
const post = (path, body) => authRequest(`${API}${path}`, { method: 'POST', body });

// Pedidos de la tienda (módulo `ordering`) y entrega al repartidor (módulo `dispatch`).
export const merchantApi = {
  orders: (storeId) => authRequest(`${API}/stores/${storeId}/orders`),
  accept: (id) => post(`/store-orders/${id}/accept`),
  reject: (id, reason) => post(`/store-orders/${id}/reject`, { reason }),
  preparing: (id) => post(`/store-orders/${id}/preparing`),
  ready: (id) => post(`/store-orders/${id}/ready`),
  // El repartidor le dice su código a la tienda y ella lo confirma al entregarle el pedido.
  confirmPickup: (id, code) => post(`/deliveries/store-orders/${id}/confirm-pickup`, { code }),
};

/** Pedido que la tienda todavía tiene que aceptar o rechazar. */
export const isNew = (o) => o.status === 'paid';
export const isOpenOrder = (o) => ['accepted', 'preparing', 'ready'].includes(o.status);

// Pitido corto para avisar de un pedido nuevo. Los navegadores solo dejan sonar tras una interacción; si no, se ignora.
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.15);
    });
    setTimeout(() => ctx.close(), 800);
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* sin audio: solo queda el aviso en pantalla */
  }
}

/**
 * Pedidos de la tienda en vivo. Un WebSocket avisa cuando llega un pedido pagado y se vuelve a pedir la lista; además
 * se consulta cada 15 s por si el WebSocket se cae. `notice` trae el aviso de pedidos nuevos hasta que se descarta.
 */
export function useLiveStoreOrders(storeId) {
  const orders = usePolled(() => merchantApi.orders(storeId), { every: 15000, enabled: Boolean(storeId) });
  const { refresh } = orders;
  const [notice, setNotice] = useState('');
  const seen = useRef(null); // ids de pedidos nuevos ya vistos; null hasta la primera carga

  useEffect(() => {
    if (!orders.data) return;
    const fresh = orders.data.filter(isNew).map((o) => o.id);
    if (seen.current) {
      const added = fresh.filter((id) => !seen.current.has(id));
      if (added.length) {
        setNotice(added.length === 1 ? '¡Te llegó un pedido nuevo!' : `¡Te llegaron ${added.length} pedidos nuevos!`);
        beep();
      }
    }
    seen.current = new Set([...(seen.current ?? []), ...fresh]);
  }, [orders.data]);

  useEffect(() => {
    if (!storeId) return undefined;
    let socket;
    let timer;
    let closed = false;

    const connect = async () => {
      try {
        await authRequest(`${API}/identity/me`); // renueva el token si venció, para que el WebSocket lo acepte
      } catch {
        return;
      }
      if (closed) return;
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${scheme}://${window.location.host}${API}/stores/${storeId}/orders/ws?token=${getAccessToken()}`);
      socket.onmessage = () => refresh();
      socket.onclose = () => {
        if (!closed) timer = setTimeout(connect, 4000);
      };
    };
    connect();

    return () => {
      closed = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [storeId, refresh]);

  const dismiss = useCallback(() => setNotice(''), []);
  return { ...orders, notice, dismiss };
}

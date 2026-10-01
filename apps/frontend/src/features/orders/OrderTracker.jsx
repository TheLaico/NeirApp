import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../notifications/NotificationsContext.jsx';
import { ordersApi } from './api.js';
import { describeChanges, isFinished, snapshotOf } from './orderTracking.js';
import './order-tracker.css';

const EVERY = 8000; // cada cuánto se revisan los pedidos
const STORAGE = 'neirapp.frontend.order-tracking';
const TOAST_MS = 7000;
// Con estos estados de tienda ya puede haber repartidor: recién ahí vale la pena consultar la entrega.
const MAY_HAVE_DELIVERY = ['accepted', 'preparing', 'ready', 'handed_over'];

const readSnapshots = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE)) ?? {};
  } catch {
    return {};
  }
};
const writeSnapshots = (data) => {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(data));
  } catch {
    /* sin almacenamiento: los avisos siguen funcionando, solo se pueden repetir al recargar */
  }
};

/**
 * Vigila los pedidos del cliente y le avisa de cada avance: aceptado, en preparación, listo, repartidor asignado,
 * recogido, en camino y entregado. Los avisos quedan en Notificaciones y además se muestran un momento arriba.
 * No dibuja nada salvo ese aviso emergente.
 */
export default function OrderTracker({ userId }) {
  const { add } = useNotifications();
  const [toast, setToast] = useState(null);
  const addRef = useRef(add);
  addRef.current = add;

  useEffect(() => {
    let stopped = false;

    const check = async () => {
      if (document.hidden) return;
      try {
        const orders = await ordersApi.list();
        const snapshots = readSnapshots();
        const fresh = [];
        for (const order of orders) {
          const prev = snapshots[order.id];
          if (prev && isFinished(prev)) continue;
          let delivery = null;
          if (order.store_orders.some((so) => MAY_HAVE_DELIVERY.includes(so.status))) {
            try {
              delivery = await ordersApi.delivery(order.id);
            } catch {
              delivery = null;
            }
          }
          fresh.push(...describeChanges(prev, order, delivery));
          snapshots[order.id] = snapshotOf(order, delivery);
        }
        if (stopped) return;
        writeSnapshots(snapshots);
        fresh.forEach((n) => addRef.current(n));
        if (fresh.length) setToast(fresh[fresh.length - 1]);
      } catch {
        /* sin conexión o sesión vencida: se reintenta en el siguiente ciclo */
      }
    };

    check();
    const id = setInterval(check, EVERY);
    document.addEventListener('visibilitychange', check);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [userId]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="order-toast" role="status" aria-live="polite">
      <div>
        <strong>{toast.title}</strong>
        <span>{toast.body}</span>
      </div>
      <button type="button" onClick={() => setToast(null)} aria-label="Cerrar aviso">
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

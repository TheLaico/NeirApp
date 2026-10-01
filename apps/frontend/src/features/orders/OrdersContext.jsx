import { createContext, useContext, useMemo } from 'react';
import { usePersistentState } from '../../lib/usePersistentState.js';

// Pedidos del cliente, guardados en el navegador mientras el backend no expone un checkout con la sesión real.
// order = { id, createdAt, items[], totalCop, delivery{address,notes}, payment{provider,status,reference,phone?}, status }
//   status: 'awaiting_payment' | 'confirmed' | 'payment_failed'
//   payment.status: 'pending' | 'approved' | 'rejected' | 'cash_on_delivery'
const OrdersContext = createContext(null);

const newId = () => `NP-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

export function OrdersProvider({ children }) {
  const [orders, setOrders] = usePersistentState('neirapp.frontend.orders', []);

  const value = useMemo(
    () => ({
      orders,
      create: ({ items, totalCop, delivery, payment }) => {
        const order = {
          id: newId(),
          createdAt: new Date().toISOString(),
          items,
          totalCop,
          delivery,
          payment,
          status: 'awaiting_payment',
        };
        setOrders((list) => [order, ...list]);
        return order;
      },
      update: (id, patch) =>
        setOrders((list) =>
          list.map((o) => (o.id === id ? { ...o, ...patch, payment: { ...o.payment, ...patch.payment } } : o)),
        ),
    }),
    [orders, setOrders],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useOrders debe usarse dentro de <OrdersProvider>');
  return ctx;
}

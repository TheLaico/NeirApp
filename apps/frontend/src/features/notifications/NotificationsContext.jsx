import { createContext, useContext, useMemo } from 'react';
import { usePersistentState } from '../../lib/usePersistentState.js';

// Avisos de la app: los de bienvenida y los de cada avance de los pedidos (los agrega `OrderTracker`).
const seed = () => {
  const now = new Date().toISOString();
  return [
    {
      id: 'welcome',
      kind: 'welcome',
      title: '¡Bienvenido a NeirAPP!',
      body: 'Tu cuenta está lista. Explora las tiendas de Neira desde el mapa y haz tu pedido.',
      createdAt: now,
      read: false,
    },
    {
      id: 'favorites-tip',
      kind: 'favorite',
      title: 'Guarda tus productos favoritos',
      body: 'Toca el corazón de cualquier producto para encontrarlo después en la sección Favoritos.',
      createdAt: now,
      read: false,
    },
    {
      id: 'register-store',
      kind: 'store',
      title: '¿Tienes un negocio en Neira?',
      body: 'Registra tu tienda y llega a más clientes del municipio.',
      createdAt: now,
      read: false,
    },
  ];
};

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [items, setItems] = usePersistentState('neirapp.frontend.notifications', seed);

  const value = useMemo(
    () => ({
      items,
      unreadCount: items.filter((n) => !n.read).length,
      // Agrega un aviso (los más nuevos primero). Si ya existe uno con el mismo `id`, no lo repite. Se guardan los últimos 100.
      add: (notification) =>
        setItems((list) => (list.some((n) => n.id === notification.id) ? list : [notification, ...list].slice(0, 100))),
      markRead: (id) => setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n))),
      markAllRead: () => setItems((list) => list.map((n) => ({ ...n, read: true }))),
      remove: (id) => setItems((list) => list.filter((n) => n.id !== id)),
      clear: () => setItems([]),
    }),
    [items, setItems],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications debe usarse dentro de <NotificationsProvider>');
  return ctx;
}

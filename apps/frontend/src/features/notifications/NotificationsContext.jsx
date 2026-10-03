import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePersistentState } from '../../lib/usePersistentState.js';
import { notificationsApi } from './api.js';

// Avisos de la app. Hay dos fuentes y se muestran juntas, las más nuevas primero:
//  - locales (en este navegador): bienvenida y avances de los pedidos (los agrega `OrderTracker`);
//  - de la API: planes y certificados de profesionales. Se revisan cada minuto; su id empieza por "srv-"
//    y traen `link`, a dónde lleva tocarlas.
const POLL_MS = 60000;
const fromServer = (n) => ({
  id: `srv-${n.id}`,
  serverId: n.id,
  server: true,
  kind: n.kind,
  title: n.title,
  body: n.body,
  link: n.link,
  createdAt: n.created_at,
  read: n.is_read,
});
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
  const [local, setLocal] = usePersistentState('neirapp.frontend.notifications', seed);
  const [server, setServer] = useState([]);

  const reload = useCallback(async () => {
    try {
      const inbox = await notificationsApi.inbox();
      setServer(inbox.items.map(fromServer));
    } catch {
      // Sin conexión o API caída: se siguen mostrando los avisos que ya había.
    }
  }, []);

  useEffect(() => {
    reload();
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  // Los cambios se ven al instante; si la API falla, la próxima revisión los corrige.
  const patchServer = useCallback((update) => setServer((list) => update(list)), []);

  const value = useMemo(() => {
    const items = [...server, ...local].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const isServer = (id) => id.startsWith('srv-');
    const serverId = (id) => id.slice(4);
    return {
      items,
      unreadCount: items.filter((n) => !n.read).length,
      // Solo los de la API (planes y certificados): los usa el panel del profesional.
      serverItems: server,
      serverUnread: server.filter((n) => !n.read).length,
      reload,
      // Agrega un aviso local (los más nuevos primero). Si ya existe uno con el mismo `id`, no lo repite. Se guardan los últimos 100.
      add: (notification) =>
        setLocal((list) => (list.some((n) => n.id === notification.id) ? list : [notification, ...list].slice(0, 100))),
      markRead: (id) => {
        if (!isServer(id)) return setLocal((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
        patchServer((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
        notificationsApi.read(serverId(id)).catch(reload);
      },
      markAllRead: (onlyServer = false) => {
        if (!onlyServer) setLocal((list) => list.map((n) => ({ ...n, read: true })));
        patchServer((list) => list.map((n) => ({ ...n, read: true })));
        notificationsApi.readAll().catch(reload);
      },
      remove: (id) => {
        if (!isServer(id)) return setLocal((list) => list.filter((n) => n.id !== id));
        patchServer((list) => list.filter((n) => n.id !== id));
        notificationsApi.remove(serverId(id)).catch(reload);
      },
      clear: (onlyServer = false) => {
        if (!onlyServer) setLocal([]);
        patchServer(() => []);
        notificationsApi.clear().catch(reload);
      },
    };
  }, [local, setLocal, server, reload, patchServer]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications debe usarse dentro de <NotificationsProvider>');
  return ctx;
}

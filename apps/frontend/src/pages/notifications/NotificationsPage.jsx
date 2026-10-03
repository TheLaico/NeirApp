import { Bell, BellOff, Bike, Check, CheckCircle2, Heart, Package, Sparkles, Store, X } from 'lucide-react';
import PageShell from '../../components/layout/PageShell.jsx';
import { useNotifications } from '../../features/notifications/NotificationsContext.jsx';
import { SERVER_KINDS } from '../../features/notifications/kinds.js';
import { useNavigate } from '../../lib/router.jsx';
import { timeAgo } from '../../lib/time.js';
import './notifications-page.css';

const ICONS = { welcome: Sparkles, favorite: Heart, store: Store, order: Package, delivery: Bike, done: CheckCircle2 };

/** Página "Notificaciones". */
export default function NotificationsPage({ user, onLogout }) {
  const { items, unreadCount, markRead, markAllRead, remove, clear } = useNotifications();
  const navigate = useNavigate();

  return (
    <PageShell
      user={user}
      onLogout={onLogout}
      title="Notificaciones"
      subtitle={unreadCount > 0 ? `Tienes ${unreadCount} sin leer.` : 'Estás al día.'}
    >
      <div className="page-narrow">
        {items.length > 0 && (
          <div className="notif-actions">
            <button type="button" className="btn-ghost" disabled={unreadCount === 0} onClick={markAllRead}>
              <Check size={16} aria-hidden="true" />
              Marcar todas como leídas
            </button>
            <button type="button" className="btn-ghost btn-danger" onClick={clear}>
              Borrar todas
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <section className="page-card">
            <div className="empty-state">
              <BellOff size={46} aria-hidden="true" />
              <p>No tienes notificaciones.</p>
              <small>Aquí verás los avisos de tus pedidos y las novedades de NeirAPP.</small>
            </div>
          </section>
        ) : (
          <ul className="notif-list">
            {items.map((n) => {
              const Icon = ICONS[n.kind] ?? SERVER_KINDS[n.kind]?.Icon ?? Bell;
              return (
                <li key={n.id} className={`notif${n.read ? '' : ' unread'}`}>
                  <button
                    type="button"
                    className="notif-main"
                    aria-label={`${n.title}${n.read ? '' : ' (sin leer)'}. ${n.link ? 'Abrir' : 'Marcar como leída'}`}
                    onClick={() => {
                      markRead(n.id);
                      if (n.link) navigate(n.link);
                    }}
                  >
                    <span className={`notif-icon${SERVER_KINDS[n.kind] ? ` ${SERVER_KINDS[n.kind].tone}` : ''}`}>
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <span className="notif-text">
                      <strong>{n.title}</strong>
                      <span>{n.body}</span>
                      {/* Algunos avisos traen una acción (p. ej. "Mirar motocarro"); toda la fila la abre. */}
                      {n.link && SERVER_KINDS[n.kind]?.action && <span className="notif-action">{SERVER_KINDS[n.kind].action}</span>}
                      <time dateTime={n.createdAt}>{timeAgo(n.createdAt)}</time>
                    </span>
                    {!n.read && <span className="notif-dot" aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    className="notif-remove"
                    aria-label={`Borrar notificación: ${n.title}`}
                    onClick={() => remove(n.id)}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageShell>
  );
}

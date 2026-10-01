import { Bell, BellOff, CheckCheck, ChevronRight, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useNotifications } from '../../features/notifications/NotificationsContext.jsx';
import { SERVER_KINDS } from '../../features/notifications/kinds.js';
import { sinceLabel } from '../../features/professionals/appointments.js';

const SECTION = /^\/profesional\?seccion=(\w+)$/;

// "Hoy", "Ayer" o "Antes", según la fecha del aviso en este dispositivo.
function groupOf(iso) {
  const day = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return 'Hoy';
  if (day.toDateString() === yesterday.toDateString()) return 'Ayer';
  return 'Antes';
}

/**
 * "Notificaciones" del panel del profesional: solicitudes nuevas o canceladas y certificados revisados. Al tocar un
 * aviso se marca como leído y se abre la sección correspondiente del panel (`onGo`).
 */
export default function NotificationsView({ onGo, onNavigate }) {
  const { serverItems: items, serverUnread: unread, markRead, markAllRead, remove, clear } = useNotifications();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const shown = onlyUnread ? items.filter((n) => !n.read) : items;

  const open = (n) => {
    markRead(n.id);
    const section = n.link?.match(SECTION)?.[1];
    if (section) onGo(section);
    else if (n.link) onNavigate(n.link);
  };

  const groups = [];
  shown.forEach((n) => {
    const label = groupOf(n.createdAt);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  });

  return (
    <div className="nt">
      <div className="sv-head">
        <div>
          <h1>Notificaciones</h1>
          <p>{unread > 0 ? `Tienes ${unread} ${unread === 1 ? 'aviso sin leer' : 'avisos sin leer'}.` : 'Estás al día. Aquí te avisamos de nuevas solicitudes, citas canceladas y certificados revisados.'}</p>
        </div>
      </div>

      {items.length > 0 && (
        <div className="nt-bar">
          <div className="rq-tabs" role="tablist" aria-label="Filtrar notificaciones">
            <button type="button" role="tab" aria-selected={!onlyUnread} className={!onlyUnread ? 'on' : ''} onClick={() => setOnlyUnread(false)}>
              Todas
            </button>
            <button type="button" role="tab" aria-selected={onlyUnread} className={onlyUnread ? 'on' : ''} onClick={() => setOnlyUnread(true)}>
              Sin leer {unread > 0 && <span className="rq-tab-count hot">{unread}</span>}
            </button>
          </div>
          <div className="nt-actions">
            <button type="button" className="nt-link" disabled={unread === 0} onClick={() => markAllRead(true)}>
              <CheckCheck size={16} aria-hidden="true" /> Marcar todas como leídas
            </button>
            <button
              type="button"
              className="nt-link danger"
              onClick={() => {
                if (window.confirm('¿Borrar todas las notificaciones?')) clear(true);
              }}
            >
              <Trash2 size={16} aria-hidden="true" /> Borrar todas
            </button>
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <section className="rq-empty">
          {onlyUnread ? <Bell size={34} aria-hidden="true" /> : <BellOff size={34} aria-hidden="true" />}
          <p>{onlyUnread ? 'No tienes avisos sin leer.' : 'Todavía no tienes notificaciones. Cuando alguien te pida una cita o revisemos tus certificados, te avisaremos aquí.'}</p>
        </section>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="nt-group" aria-label={group.label}>
            <h2>{group.label}</h2>
            <ul className="nt-list">
              {group.items.map((n) => {
                const { Icon, tone } = SERVER_KINDS[n.kind] ?? { Icon: Bell, tone: 'info' };
                return (
                  <li key={n.id} className={`nt-item${n.read ? '' : ' unread'}`}>
                    <button type="button" className="nt-main" onClick={() => open(n)}>
                      <span className={`nt-icon ${tone}`}>
                        <Icon size={22} aria-hidden="true" />
                      </span>
                      <span className="nt-text">
                        <strong>{n.title}</strong>
                        <span>{n.body}</span>
                        <time dateTime={n.createdAt}>{sinceLabel(n.createdAt)}</time>
                      </span>
                      {!n.read && <span className="nt-dot" aria-label="Sin leer" />}
                      <ChevronRight size={18} className="nt-chev" aria-hidden="true" />
                    </button>
                    <button type="button" className="nt-remove" aria-label={`Borrar: ${n.title}`} onClick={() => remove(n.id)}>
                      <X size={16} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

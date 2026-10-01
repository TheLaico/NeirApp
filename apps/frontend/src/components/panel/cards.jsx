import { CalendarDays, ChevronRight, DollarSign, Megaphone, Package, ShoppingCart, Star, Wallet } from 'lucide-react';
import { timeAgo } from '../../lib/time.js';
import SolidIcon from '../icons/Solid.jsx';
import './panel-desktop.css';

// Tarjetas del diseño de los paneles que comparten comerciante y repartidor. Solo reciben datos ya calculados.

const STAT_ICON = { order: ShoppingCart, money: DollarSign, star: Star, wallet: Wallet };
const NOTICE_ICON = { order: ShoppingCart, route: Package, bad: Megaphone, review: Megaphone, pay: DollarSign };
const hour = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

/**
 * "Resumen de hoy": tres cifras con su círculo de color.
 * `items` = [{ icon: 'order' | 'money' | 'star' | 'wallet', tone: 'green' | 'gold', value, label }]
 */
export function StatsCard({ title = 'Resumen de hoy', date, items }) {
  return (
    <section className="md-card">
      <div className="md-card-head">
        <h2>{title}</h2>
        {date && (
          <span className="md-date">
            <CalendarDays size={16} aria-hidden="true" /> {date}
          </span>
        )}
      </div>
      <div className="md-today">
        {items.map(({ icon, tone = 'green', value, label }) => {
          const Icon = STAT_ICON[icon];
          return (
            <div key={label}>
              <span className={`md-bubble ${tone}`}>
                <Icon size={icon === 'star' ? 22 : 24} fill={icon === 'star' ? 'currentColor' : 'none'} aria-hidden="true" />
              </span>
              <strong>{value}</strong>
              <small>{label}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * "Notificaciones": los avisos más recientes.
 * `notices` = [{ id, kind: 'order' | 'route' | 'bad' | 'review' | 'pay', at, title, text }]; `onOpen(notice)` al tocar uno.
 */
export function NoticesCard({ notices, onOpen, onSeeAll, empty = 'Aquí verás los avisos que lleguen.', limit = 3 }) {
  const shown = notices.slice(0, limit);
  return (
    <section className="md-card">
      <div className="md-card-head">
        <h2>
          <SolidIcon name="bell" size={22} /> Notificaciones
        </h2>
        <button type="button" className="md-more" onClick={onSeeAll}>
          Ver todas <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="md-empty">{empty}</p>
      ) : (
        <ul className="md-notices">
          {shown.map((n) => {
            const Icon = NOTICE_ICON[n.kind];
            return (
              <li key={n.id}>
                <button type="button" onClick={() => onOpen(n)}>
                  <span className={`md-bubble ${n.kind}`}>
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <span className="md-notice-text">
                    <strong>{n.title}</strong>
                    <span>{n.text}</span>
                    <small>
                      {hour(n.at)} · {timeAgo(n.at)}
                    </small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" className="md-chev" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

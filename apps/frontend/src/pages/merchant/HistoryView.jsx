import { formatCop } from '../../lib/money.js';
import { timeAgo } from '../../lib/time.js';

const DONE = ['rejected', 'handed_over'];

/** Pedidos ya cerrados: entregados al repartidor o rechazados (con el motivo que se le dio al cliente). */
export default function HistoryView({ orders }) {
  const done = (orders ?? []).filter((o) => DONE.includes(o.status)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  if (!orders) return <p className="cr-empty">Cargando…</p>;
  if (done.length === 0) return <p className="cr-empty">Todavía no tienes pedidos cerrados.</p>;

  return (
    <ul className="cr-list">
      {done.map((o) => (
        <li key={o.id} className="cr-card">
          <div className="cr-card-head">
            <strong>Pedido #{o.order_id.slice(0, 6).toUpperCase()}</strong>
            <span className={`cr-chip ${o.status === 'handed_over' ? 'ok' : ''}`}>{o.status === 'handed_over' ? 'Entregado' : 'Rechazado'}</span>
          </div>
          <p className="cr-muted">{o.lines.map((l) => `${l.quantity} × ${l.name}`).join(' · ')}</p>
          {o.rejection_reason && <p className="cr-rejected">Motivo: {o.rejection_reason}</p>}
          <small className="cr-muted">
            {formatCop(o.subtotal_cop)} · {timeAgo(o.updated_at)}
          </small>
        </li>
      ))}
    </ul>
  );
}

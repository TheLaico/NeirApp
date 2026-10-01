import { earningsByDelivery, DELIVERY_STATUS, formatCop, shortCode } from './model.js';
import './courier-panel.css';

const date = (iso) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

/** Entregas anteriores del repartidor, con lo que ganó en cada una. */
export default function HistoryView({ history, ledger, error, query = '' }) {
  const earnings = earningsByDelivery(ledger);
  const q = query.trim().toLowerCase();
  const list = (history ?? []).filter((d) => !q || shortCode(d.order_id).toLowerCase().includes(q) || d.stops.some((s) => s.store_name.toLowerCase().includes(q)));

  return (
    <section className="md-card">
      <div className="md-card-head">
        <h2>Historial de entregas</h2>
      </div>
      {error && !history && (
        <p className="cr-error" role="alert">
          {error}
        </p>
      )}
      {!history ? (
        !error && <p className="md-empty">Cargando…</p>
      ) : list.length === 0 ? (
        <p className="md-empty">{q ? 'Ninguna entrega coincide con tu búsqueda.' : 'Todavía no tienes entregas.'}</p>
      ) : (
        <ul className="md-rows">
          {list.map((d) => {
            const status = DELIVERY_STATUS[d.status] ?? { label: d.status, tone: 'prep' };
            return (
              <li key={d.id} className="md-row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <span className="md-row-main">
                  <strong>Pedido #{shortCode(d.order_id)}</strong>
                  <span>{d.stops.map((s) => s.store_name).join(' · ')}</span>
                  <span>
                    {date(d.delivered_at ?? d.updated_at)}
                    {earnings.has(d.id) && <b className="md-money"> · +{formatCop(earnings.get(d.id))}</b>}
                  </span>
                </span>
                <span className={`md-pill ${status.tone}`}>{status.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

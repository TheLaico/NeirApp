import { Loader2, MapPin, Store } from 'lucide-react';
import { useState } from 'react';
import { courierApi, mapsUrl } from '../../features/courier/api.js';
import { availableMatches, formatCop, shortCode, STORE_STATUS } from './model.js';
import './courier-panel.css';

/** Pedidos disponibles para tomar (filtrables con el buscador). Al aceptar uno se abre su detalle. */
export default function AvailableView({ orders, error, loading, refresh, query = '', active, onClaimed, onOpenActive }) {
  const [claiming, setClaiming] = useState(null);
  const [claimError, setClaimError] = useState('');
  const list = (orders ?? []).filter((o) => availableMatches(o, query));

  const claim = async (orderId) => {
    setClaimError('');
    setClaiming(orderId);
    try {
      await courierApi.claim(orderId);
      await onClaimed();
    } catch (err) {
      setClaimError(err.message);
      refresh(); // el pedido pudo haberlo tomado otro repartidor
    } finally {
      setClaiming(null);
    }
  };

  return (
    <>
      {active && (
        <button type="button" className="cr-banner" onClick={onOpenActive}>
          <strong>Tienes una entrega activa</strong>
          <span>Termínala para tomar otro pedido. Toca para verla.</span>
        </button>
      )}

      {claimError && (
        <p className="cr-error" role="alert">
          {claimError}
        </p>
      )}
      {error && !orders && (
        <p className="cr-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="cr-empty">Buscando pedidos…</p>}
      {orders && list.length === 0 && (
        <div className="cr-state">
          <p className="cr-empty">{query ? 'Ningún pedido coincide con tu búsqueda.' : 'No hay pedidos disponibles por ahora. Se actualiza solo.'}</p>
          <button type="button" className="cr-btn ghost" onClick={refresh}>
            Actualizar
          </button>
        </div>
      )}

      <ul className="cr-list">
        {list.map((order) => (
          <li key={order.order_id} className="cr-card">
            <div className="cr-card-head">
              <strong>Pedido #{shortCode(order.order_id)}</strong>
              <span className="cr-chip">{order.stops.length === 1 ? '1 tienda' : `${order.stops.length} tiendas`}</span>
            </div>
            <ul className="cr-stops">
              {order.stops.map((stop) => (
                <li key={stop.store_order_id}>
                  <Store size={16} aria-hidden="true" />
                  <span>{stop.store_name}</span>
                  <small className={`cr-status ${stop.status}`}>{STORE_STATUS[stop.status] ?? stop.status}</small>
                </li>
              ))}
            </ul>
            <p className="cr-earn">Ganas <strong>{formatCop(order.courier_earnings_cop)}</strong> por esta entrega</p>
            {order.delivery_notes && <p className="cr-notes">“{order.delivery_notes}”</p>}
            <a className="cr-link" href={mapsUrl(order.delivery_lat, order.delivery_lng)} target="_blank" rel="noreferrer">
              <MapPin size={16} aria-hidden="true" />
              Ver dónde se entrega
            </a>
            <button type="button" className="cr-btn primary" disabled={Boolean(active) || claiming !== null} onClick={() => claim(order.order_id)}>
              {claiming === order.order_id && <Loader2 size={18} className="cr-spin" aria-hidden="true" />}
              Aceptar
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

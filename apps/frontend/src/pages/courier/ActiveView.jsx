import { CheckCircle2, KeyRound, Loader2, MapPin, Phone, Store } from 'lucide-react';
import { useState } from 'react';
import { courierApi } from '../../features/courier/api.js';
import DestinationMap from './DestinationMap.jsx';
import { formatCop } from './model.js';

/** Recogidas pendientes primero, en el orden de ruta que sugiere el backend; las ya recogidas al final. */
function orderedStops(delivery) {
  const rank = new Map(delivery.suggested_stop_order.map((id, i) => [id, i]));
  return [...delivery.stops].sort((a, b) => {
    if (a.is_picked_up !== b.is_picked_up) return a.is_picked_up ? 1 : -1;
    return (rank.get(a.store_order_id) ?? 0) - (rank.get(b.store_order_id) ?? 0);
  });
}

function EmptyActive({ onGoHome }) {
  return (
    <div className="cr-state">
      <p className="cr-empty">No tienes una entrega activa.</p>
      <button type="button" className="cr-btn primary" onClick={onGoHome}>
        Ver pedidos disponibles
      </button>
    </div>
  );
}

/** Formulario del código que le da el cliente al repartidor al entregar el pedido. */
function DeliveryCodeForm({ delivery, onDone }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!code.trim()) return setError('Escribe el código que te da el cliente.');
    setBusy(true);
    try {
      await courierApi.confirmDelivery(delivery.id, code.trim());
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const ready = delivery.all_stops_picked_up;
  return (
    <form className="cr-card cr-form" onSubmit={submit} noValidate>
      <h2>Código del cliente</h2>
      <p className="cr-muted">
        {ready
          ? 'Pídele al cliente el código de su pedido y escríbelo aquí para terminar la entrega.'
          : 'Primero debes recoger el pedido en todas las tiendas: cada tienda confirma con tu código de recogida.'}
      </p>
      <input
        className="cr-code-input"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        maxLength={6}
        disabled={!ready}
        aria-label="Código de entrega del cliente"
      />
      {error && (
        <p className="cr-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="cr-btn primary" disabled={!ready || busy}>
        {busy && <Loader2 size={18} className="cr-spin" aria-hidden="true" />}
        Confirmar entrega
      </button>
    </form>
  );
}

/** Detalle de la entrega activa (`detail`) o la pantalla para introducir el código del cliente (`code`). */
export default function ActiveView({ mode, delivery, loading, onChanged, onGoHome, onGoCode }) {
  const [cancelError, setCancelError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [map, setMap] = useState(null); // destino que se está viendo en el mapa: { title, subtitle, lat, lng }

  if (completed) {
    return (
      <div className="cr-state success" role="status">
        <CheckCircle2 size={52} aria-hidden="true" />
        <h2>¡Entrega completada!</h2>
        <p>El pago de esta entrega ya quedó en tu billetera.</p>
        <button type="button" className="cr-btn primary" onClick={onGoHome}>
          Ver pedidos disponibles
        </button>
      </div>
    );
  }

  if (loading) return <p className="cr-empty">Cargando…</p>;
  if (!delivery) return <EmptyActive onGoHome={onGoHome} />;

  if (mode === 'code') {
    const done = async () => {
      setCompleted(true);
      await onChanged();
    };
    return <DeliveryCodeForm key={delivery.id} delivery={delivery} onDone={done} />;
  }

  const cancel = async () => {
    if (!window.confirm('¿Cancelar esta entrega? El pedido quedará disponible para que lo tome otro repartidor.')) return;
    setCancelError('');
    setCancelling(true);
    try {
      await courierApi.cancel(delivery.id);
      await onChanged();
      onGoHome();
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const stops = orderedStops(delivery);
  const pending = stops.filter((s) => !s.is_picked_up).length;

  return (
    <>
      {map && <DestinationMap {...map} onClose={() => setMap(null)} />}
      <p className="cr-earn">
        Ganas <strong>{formatCop(delivery.courier_earnings_cop)}</strong> por esta entrega
      </p>
      <p className="cr-muted cr-lead">
        {pending > 0
          ? `Te falta recoger en ${pending === 1 ? '1 tienda' : `${pending} tiendas`}. Dale a cada tienda su código.`
          : 'Ya recogiste todo. Ve a entregarlo al cliente.'}
      </p>

      <ol className="cr-list">
        {stops.map((stop, i) => (
          <li key={stop.store_order_id} className={`cr-card cr-stop${stop.is_picked_up ? ' done' : ''}`}>
            <div className="cr-card-head">
              <strong>
                <Store size={17} aria-hidden="true" /> {i + 1}. {stop.store_name}
              </strong>
              {stop.is_picked_up ? <span className="cr-chip ok">Recogido ✓</span> : <span className={`cr-chip ${stop.is_ready ? 'ok' : ''}`}>{stop.is_ready ? '¡Listo para recoger!' : 'Preparando…'}</span>}
            </div>
            {!stop.is_picked_up && (
              <>
                <p className="cr-muted">{stop.is_ready ? 'La tienda ya tiene el pedido listo. Ve por él.' : 'La tienda aún lo está preparando; te avisamos cuando esté listo.'}</p>
                <p className="cr-code-label">Código para la tienda</p>
                <p className="cr-code" aria-label={`Código de recogida ${stop.pickup_code.split('').join(' ')}`}>
                  {stop.pickup_code}
                </p>
                <button type="button" className="cr-link" onClick={() => setMap({ title: stop.store_name, subtitle: 'Tienda donde recoges', lat: stop.lat, lng: stop.lng })}>
                  <MapPin size={16} aria-hidden="true" />
                  Cómo llegar a la tienda
                </button>
              </>
            )}
          </li>
        ))}

        <li className="cr-card">
          <div className="cr-card-head">
            <strong>
              <MapPin size={17} aria-hidden="true" /> Entrega al cliente
            </strong>
          </div>
          {delivery.customer_phone && (
            <div className="cr-contact">
              <span>
                <small>Cliente</small>
                <strong>{delivery.customer_name}</strong>
                <span>{delivery.customer_phone}</span>
              </span>
              <a className="cr-btn primary sm" href={`tel:${delivery.customer_phone.replace(/[^\d+]/g, '')}`} aria-label={`Llamar a ${delivery.customer_name}`}>
                <Phone size={17} aria-hidden="true" />
                Llamar
              </a>
            </div>
          )}
          <button type="button" className="cr-link" onClick={() => setMap({ title: 'Entrega al cliente', subtitle: 'Punto de entrega', lat: delivery.delivery_lat, lng: delivery.delivery_lng })}>
            <MapPin size={16} aria-hidden="true" />
            Cómo llegar al cliente
          </button>
          <button type="button" className="cr-btn primary" disabled={!delivery.all_stops_picked_up} onClick={onGoCode}>
            <KeyRound size={18} aria-hidden="true" />
            Introducir código del cliente
          </button>
          {!delivery.all_stops_picked_up && <p className="cr-muted">Se activa cuando todas las tiendas confirmen la recogida.</p>}
        </li>
      </ol>

      {cancelError && (
        <p className="cr-error" role="alert">
          {cancelError}
        </p>
      )}
      {/* Con algo ya recogido no se puede cancelar: la mercancía está con el repartidor. */}
      {stops.some((s) => s.is_picked_up) ? (
        <p className="cr-muted cr-lead">Ya recogiste un pedido, así que no puedes cancelar: debes entregarlo al cliente.</p>
      ) : (
        <button type="button" className="cr-btn danger" disabled={cancelling} onClick={cancel}>
          Cancelar entrega
        </button>
      )}
    </>
  );
}

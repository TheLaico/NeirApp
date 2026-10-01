import { CheckCircle2, KeyRound, Loader2, PackageCheck } from 'lucide-react';
import { useState } from 'react';
import { isNew, isOpenOrder, merchantApi } from '../../features/merchant/api.js';
import { storesApi } from '../../features/stores/api.js';
import { CLOSED_REASON, nextOpenText } from '../../features/stores/schedule.js';
import { formatCop } from '../../lib/money.js';
import { timeAgo } from '../../lib/time.js';

const REASONS = ['No tenemos el producto', 'Estamos cerrados', 'Mucha demanda ahora', 'Otro motivo'];
const STATUS = { accepted: 'Aceptado', preparing: 'Preparando', ready: 'Listo ✓' };

/** Ejecuta una acción sobre un pedido mostrando "cargando" y el error si falla. */
function useAction(onDone) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn) => {
    setError('');
    setBusy(true);
    try {
      await fn();
      await onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}

function Lines({ order }) {
  return (
    <>
      <ul className="cr-lines">
        {order.lines.map((line) => (
          <li key={line.product_id}>
            <span>
              {line.quantity} × {line.name}
            </span>
            <span>{formatCop(line.subtotal_cop)}</span>
          </li>
        ))}
      </ul>
      <p className="cr-total">
        <span>Total</span>
        <span>{formatCop(order.subtotal_cop)}</span>
      </p>
    </>
  );
}

/** Pedido nuevo: la tienda lo acepta o lo rechaza dando un motivo. */
function NewOrderCard({ order, onChanged }) {
  const { busy, error, run, setError } = useAction(onChanged);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const reject = () => {
    if (reason.trim().length < 3) return setError('Escribe el motivo del rechazo (mínimo 3 letras).');
    run(() => merchantApi.reject(order.id, reason.trim()));
  };

  return (
    <li className="cr-card">
      <div className="cr-card-head">
        <strong>Pedido #{order.order_id.slice(0, 6).toUpperCase()}</strong>
        <span className="cr-chip">{timeAgo(order.created_at)}</span>
      </div>
      <Lines order={order} />

      {rejecting ? (
        <>
          <p className="cr-code-label">¿Por qué lo rechazas? El cliente verá este motivo.</p>
          <div className="cr-chips">
            {REASONS.map((r) => (
              <button key={r} type="button" className={reason === r ? 'on' : ''} onClick={() => setReason(r === 'Otro motivo' ? '' : r)}>
                {r}
              </button>
            ))}
          </div>
          <textarea className="cr-textarea" rows={2} maxLength={300} value={reason} placeholder="Escribe el motivo" aria-label="Motivo del rechazo" onChange={(e) => setReason(e.target.value)} />
          {error && (
            <p className="cr-error" role="alert">
              {error}
            </p>
          )}
          <div className="cr-actions">
            <button type="button" className="cr-btn ghost sm" disabled={busy} onClick={() => setRejecting(false)}>
              Volver
            </button>
            <button type="button" className="cr-btn danger sm" disabled={busy} onClick={reject}>
              {busy && <Loader2 size={16} className="cr-spin" aria-hidden="true" />}
              Rechazar pedido
            </button>
          </div>
        </>
      ) : (
        <>
          {error && (
            <p className="cr-error" role="alert">
              {error}
            </p>
          )}
          <div className="cr-actions">
            <button type="button" className="cr-btn danger sm" disabled={busy} onClick={() => setRejecting(true)}>
              Rechazar
            </button>
            <button type="button" className="cr-btn primary sm" disabled={busy} onClick={() => run(() => merchantApi.accept(order.id))}>
              {busy && <Loader2 size={16} className="cr-spin" aria-hidden="true" />}
              Aceptar
            </button>
          </div>
        </>
      )}
    </li>
  );
}

/** Pedido aceptado: se avisa cuando está listo y se entrega al repartidor con su código. */
function OpenOrderCard({ order, onChanged }) {
  const { busy, error, run } = useAction(onChanged);
  const [code, setCode] = useState('');
  const ready = order.status === 'ready';

  // El backend exige pasar por "preparando" antes de "listo": para la tienda es un solo botón.
  const markReady = () =>
    run(async () => {
      if (order.status === 'accepted') await merchantApi.preparing(order.id);
      await merchantApi.ready(order.id);
    });

  const handOver = (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    run(() => merchantApi.confirmPickup(order.id, code.trim()));
  };

  return (
    <li className="cr-card">
      <div className="cr-card-head">
        <strong>Pedido #{order.order_id.slice(0, 6).toUpperCase()}</strong>
        <span className={`cr-chip ${ready ? 'ok' : ''}`}>{STATUS[order.status]}</span>
      </div>
      <Lines order={order} />

      {!ready && (
        <button type="button" className="cr-btn primary" disabled={busy} onClick={markReady}>
          {busy ? <Loader2 size={18} className="cr-spin" aria-hidden="true" /> : <PackageCheck size={18} aria-hidden="true" />}
          El pedido ya está listo
        </button>
      )}

      <form className="cr-form" onSubmit={handOver} noValidate>
        <label>
          Código del repartidor
          <div className="cr-row">
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
              aria-label="Código de recogida del repartidor"
            />
          </div>
        </label>
        {!ready && <p className="cr-muted">Cuando marques el pedido como listo podrás entregárselo al repartidor con su código.</p>}
        {error && (
          <p className="cr-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="cr-btn primary" disabled={!ready || busy || !code.trim()}>
          <KeyRound size={18} aria-hidden="true" />
          Entregar al repartidor
        </button>
      </form>
    </li>
  );
}

/** Pedidos: los nuevos primero, luego los que la tienda tiene en curso. Incluye abrir/cerrar la tienda. */
export default function OrdersView({ store, orders, error, loading, query = '', onChanged, onStoreChanged }) {
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState('');

  const toggleOpen = async () => {
    setToggleError('');
    setToggling(true);
    try {
      await storesApi.setOpen(store.id, !manualOpen);
      await onStoreChanged();
    } catch (err) {
      setToggleError(err.message);
    } finally {
      setToggling(false);
    }
  };

  // El interruptor es solo tuyo; que la tienda esté abierta ahora depende además del horario y de los días marcados.
  const manualOpen = store.is_open_manual ?? store.is_open;
  const q = query.trim().toLowerCase();
  const matches = (o) => !q || o.order_id.slice(0, 6).toLowerCase().includes(q) || o.lines.some((l) => l.name.toLowerCase().includes(q));
  const fresh = (orders ?? []).filter(isNew).filter(matches);
  const open = (orders ?? []).filter(isOpenOrder).filter(matches);

  return (
    <>
      <section className="cr-card">
        <div className="cr-switch-row">
          <div>
            <strong>{store.name}</strong>
            <small>
              {store.is_open
                ? 'Abierta: recibes pedidos'
                : manualOpen
                  ? `${CLOSED_REASON[store.closed_reason]}${store.next_open_at ? ` Abres ${nextOpenText(store.next_open_at)}` : ''}`
                  : 'Cerrada con el interruptor: no recibes pedidos'}
            </small>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={manualOpen}
            aria-label={`${store.name}: interruptor ${manualOpen ? 'encendido' : 'apagado'}`}
            className={`a-switch${manualOpen ? ' on' : ''}`}
            disabled={toggling}
            onClick={toggleOpen}
          >
            <span />
          </button>
        </div>
        {toggleError && (
          <p className="cr-error" role="alert">
            {toggleError}
          </p>
        )}
      </section>

      {error && !orders && (
        <p className="cr-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="cr-empty">Cargando pedidos…</p>}
      {orders && fresh.length === 0 && open.length === 0 && (
        <div className="cr-state">
          <CheckCircle2 size={40} aria-hidden="true" />
          <p className="cr-empty">No tienes pedidos pendientes. Te avisamos apenas llegue uno.</p>
        </div>
      )}

      {fresh.length > 0 && (
        <>
          <h2 className="cr-section">Nuevos ({fresh.length})</h2>
          <ul className="cr-list">
            {fresh.map((o) => (
              <NewOrderCard key={o.id} order={o} onChanged={onChanged} />
            ))}
          </ul>
        </>
      )}
      {open.length > 0 && (
        <>
          <h2 className="cr-section">En curso ({open.length})</h2>
          <ul className="cr-list">
            {open.map((o) => (
              <OpenOrderCard key={o.id} order={o} onChanged={onChanged} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

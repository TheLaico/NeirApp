import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { walletApi } from '../../features/courier/api.js';
import { formatCop } from './model.js';
import './courier-panel.css';

const date = (iso) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

/** Billetera: saldo, retiro y movimientos (ganancias por entrega y retiros). */
export default function WalletView({ balance, ledger, onChanged }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const withdraw = async (e) => {
    e.preventDefault();
    setError('');
    setDone('');
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) return setError('Escribe cuánto quieres retirar, en pesos.');
    if (value > (balance ?? 0)) return setError('No puedes retirar más de lo que tienes en tu saldo.');
    setBusy(true);
    try {
      await walletApi.withdraw(value);
      setAmount('');
      setDone(`Pediste retirar ${formatCop(value)}.`);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="md-card">
        <div className="md-card-head">
          <h2>Saldo disponible</h2>
        </div>
        <div className="cr-balance">
          <strong>{formatCop(balance ?? 0)}</strong>
          <small>Cada entrega completada suma su ganancia aquí.</small>
        </div>
        <form className="cr-form" onSubmit={withdraw} noValidate>
          <label className="cr-label" htmlFor="withdraw-amount">
            Retirar dinero
          </label>
          <input
            id="withdraw-amount"
            className="cr-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="Monto en pesos"
            autoComplete="off"
          />
          {error && (
            <p className="cr-error" role="alert">
              {error}
            </p>
          )}
          {done && <p className="cr-muted">{done}</p>}
          <button type="submit" className="cr-btn primary" disabled={busy || !amount}>
            {busy && <Loader2 size={18} className="cr-spin" aria-hidden="true" />}
            Solicitar retiro
          </button>
        </form>
      </section>

      <section className="md-card">
        <div className="md-card-head">
          <h2>Movimientos</h2>
        </div>
        {!ledger ? (
          <p className="md-empty">Cargando…</p>
        ) : ledger.length === 0 ? (
          <p className="md-empty">Aún no tienes movimientos. Completa una entrega para recibir tu primera ganancia.</p>
        ) : (
          <ul className="md-rows cr-ledger">
            {ledger.map((e) => (
              <li key={e.id} className="md-row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <span className="md-row-main">
                  <strong>{e.type === 'credit' ? 'Ganancia por entrega' : 'Retiro'}</strong>
                  <small>{date(e.created_at)}</small>
                </span>
                <strong className={e.type === 'credit' ? 'cr-plus' : 'cr-minus'}>
                  {e.type === 'credit' ? '+' : '−'}
                  {formatCop(e.amount_cop)}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

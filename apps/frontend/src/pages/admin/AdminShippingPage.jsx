import { Bike, Loader2, ShieldCheck, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePolled } from '../../features/courier/api.js';
import { pricingApi, splitFee } from '../../features/pricing/api.js';
import { formatCop } from '../../lib/money.js';
import AdminLayout from './AdminLayout.jsx';

const MAX_FEE = 100000;
const digits = (value) => value.replace(/\D/g, '');

/** Panel de administrador: cuánto vale el envío y cómo se reparte entre el repartidor y la plataforma. */
export default function AdminShippingPage({ user, onLogout }) {
  const pricing = usePolled(pricingApi.delivery);
  const earnings = usePolled(pricingApi.earnings, { every: 30000 });
  const [fee, setFee] = useState('');
  const [share, setShare] = useState(80);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Cuando llega lo guardado en el servidor se llenan los campos (y de nuevo solo tras guardar).
  useEffect(() => {
    if (!pricing.data) return;
    setFee(String(pricing.data.delivery_fee_cop));
    setShare(pricing.data.courier_share_percent);
  }, [pricing.data]);

  const feeNumber = Number(fee || 0);
  const split = splitFee(feeNumber, share);
  const dirty = pricing.data && (feeNumber !== pricing.data.delivery_fee_cop || share !== pricing.data.courier_share_percent);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    if (fee === '') return setError('Escribe cuánto vale el envío.');
    if (feeNumber > MAX_FEE) return setError(`El envío no puede pasar de ${formatCop(MAX_FEE)}.`);
    setBusy(true);
    try {
      await pricingApi.update(feeNumber, share);
      await pricing.refresh();
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout
      user={user}
      onLogout={onLogout}
      title="Envíos"
      subtitle="Define cuánto se le cobra al cliente por el envío de cada pedido y qué porcentaje se lleva el repartidor. El resto es de la plataforma."
    >
      <form className="a-card a-form" onSubmit={save} noValidate>
        <h2>Tarifa de envío</h2>
        {pricing.loading && <p className="a-empty">Cargando…</p>}
        {pricing.error && !pricing.data && (
          <p className="a-err" role="alert">
            {pricing.error}
          </p>
        )}

        <div className="a-field">
          <label htmlFor="ship-fee">Valor del envío (COP)</label>
          <input
            id="ship-fee"
            inputMode="numeric"
            autoComplete="off"
            value={fee}
            onChange={(e) => {
              setFee(digits(e.target.value));
              setSaved(false);
            }}
            placeholder="5000"
          />
          <small>Se cobra una vez por pedido, sin importar cuántas tiendas tenga. Puedes poner 0 para envío gratis.</small>
        </div>

        <div className="a-field">
          <label htmlFor="ship-share">Porcentaje para el repartidor: {share} %</label>
          <input
            id="ship-share"
            type="range"
            min="0"
            max="100"
            step="1"
            value={share}
            onChange={(e) => {
              setShare(Number(e.target.value));
              setSaved(false);
            }}
          />
          <small>
            Para la plataforma: {100 - share} %
          </small>
        </div>

        <div className="a-stats">
          <div className="a-stat">
            <span className="a-stat-icon">
              <Bike size={20} aria-hidden="true" />
            </span>
            <div>
              <strong>{formatCop(split.courier)}</strong>
              <small>Repartidor ({share} %)</small>
            </div>
          </div>
          <div className="a-stat">
            <span className="a-stat-icon">
              <ShieldCheck size={20} aria-hidden="true" />
            </span>
            <div>
              <strong>{formatCop(split.platform)}</strong>
              <small>Plataforma ({100 - share} %)</small>
            </div>
          </div>
        </div>

        {error && (
          <p className="a-err" role="alert">
            {error}
          </p>
        )}
        {saved && <p className="a-success">Listo: la nueva tarifa aplica a los pedidos que se hagan desde ahora.</p>}
        <div className="a-form-actions">
          <button type="submit" className="a-btn primary" disabled={busy || !dirty}>
            {busy && <Loader2 size={16} className="a-spin" aria-hidden="true" />}
            Guardar tarifa
          </button>
        </div>
        <p className="a-empty">Los pedidos que ya se hicieron conservan la tarifa con la que se crearon.</p>
      </form>

      <section className="a-card">
        <h2>Lo acumulado en envíos</h2>
        {earnings.error && !earnings.data && (
          <p className="a-err" role="alert">
            {earnings.error}
          </p>
        )}
        {earnings.data && (
          <div className="a-stats">
            <div className="a-stat">
              <span className="a-stat-icon">
                <Truck size={20} aria-hidden="true" />
              </span>
              <div>
                <strong>{earnings.data.deliveries}</strong>
                <small>Entregas completadas</small>
              </div>
            </div>
            <div className="a-stat">
              <span className="a-stat-icon">
                <Bike size={20} aria-hidden="true" />
              </span>
              <div>
                <strong>{formatCop(earnings.data.courier_cop)}</strong>
                <small>Pagado a repartidores</small>
              </div>
            </div>
            <div className="a-stat">
              <span className="a-stat-icon">
                <ShieldCheck size={20} aria-hidden="true" />
              </span>
              <div>
                <strong>{formatCop(earnings.data.platform_cop)}</strong>
                <small>Para la plataforma</small>
              </div>
            </div>
          </div>
        )}
      </section>
    </AdminLayout>
  );
}

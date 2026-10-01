import { useMemo, useState } from 'react';
import { courierApi, usePolled, VEHICLES } from '../../features/courier/api.js';
import AdminLayout from './AdminLayout.jsx';

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const when = (iso) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

const NOTES = {
  motorcycle: 'Requiere placa.',
  motocarro: 'Requiere placa.',
  car: 'Requiere placa.',
  bike: 'No requiere placa.',
};

/** Panel de administrador: qué vehículos pueden usar los repartidores al registrarse. */
export default function AdminCouriersPage({ user, onLogout }) {
  const { data, error: loadError, loading, refresh } = usePolled(courierApi.vehicleTypes);
  const ratings = usePolled(courierApi.ratings, { every: 30000 });
  // Promedio y cantidad por repartidor, del más al menos calificado.
  const perCourier = useMemo(() => {
    const map = new Map();
    for (const r of ratings.data ?? []) {
      const c = map.get(r.courier_id) ?? { id: r.courier_id, name: r.courier_name, email: r.courier_email, total: 0, count: 0 };
      c.total += r.rating;
      c.count += 1;
      map.set(r.courier_id, c);
    }
    return [...map.values()].sort((a, b) => b.total / b.count - a.total / a.count);
  }, [ratings.data]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const toggle = async (type, next) => {
    setError('');
    setBusy(type);
    try {
      await courierApi.setVehicleType(type, next);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const enabled = (type) => data?.find((t) => t.vehicle_type === type)?.is_enabled ?? false;

  return (
    <AdminLayout
      user={user}
      onLogout={onLogout}
      title="Repartidores"
      subtitle="Elige con qué vehículos se puede registrar un repartidor. Los que dejes apagados se muestran como “próximamente”."
    >
      <section className="a-card">
        <h2>Vehículos permitidos</h2>
        {loading && <p className="a-empty">Cargando…</p>}
        {loadError && !data && (
          <p className="a-err" role="alert">
            {loadError}
          </p>
        )}
        {error && (
          <p className="a-err" role="alert">
            {error}
          </p>
        )}
        {data && (
          <ul className="a-store-list">
            {VEHICLES.map(({ value, label }) => (
              <li key={value} className="a-store-row a-grant">
                <div className="a-store-info">
                  <strong>{label}</strong>
                  <span>{NOTES[value]}</span>
                </div>
                <span className={`a-badge ${enabled(value) ? 'server' : 'local'}`}>{enabled(value) ? 'Habilitado' : 'Próximamente'}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled(value)}
                  aria-label={`${label}: ${enabled(value) ? 'habilitado' : 'deshabilitado'}`}
                  className={`a-switch${enabled(value) ? ' on' : ''}`}
                  disabled={busy === value}
                  onClick={() => toggle(value, !enabled(value))}
                >
                  <span />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="a-empty">Solo afecta a quienes se registren después: los repartidores que ya tienen perfil no cambian.</p>
      </section>
      <section className="a-card">
        <h2>Calificaciones de los clientes a repartidores</h2>
        <p className="a-empty">Son privadas: solo las ves tú. Ni el público ni el propio repartidor las conocen.</p>
        {ratings.error && !ratings.data && (
          <p className="a-err" role="alert">
            {ratings.error}
          </p>
        )}
        {ratings.data?.length === 0 && <p className="a-empty">Todavía ningún cliente ha calificado a un repartidor.</p>}
        {perCourier.length > 0 && (
          <ul className="a-store-list">
            {perCourier.map((c) => (
              <li key={c.id} className="a-store-row a-grant">
                <div className="a-store-info">
                  <strong>{c.name}</strong>
                  <span>{c.email}</span>
                </div>
                <span className="a-badge server">
                  {(c.total / c.count).toFixed(1)} ★ · {c.count} {c.count === 1 ? 'calificación' : 'calificaciones'}
                </span>
              </li>
            ))}
          </ul>
        )}
        {ratings.data?.length > 0 && (
          <>
            <h2>Detalle</h2>
            <ul className="a-store-list">
              {ratings.data.map((r) => (
                <li key={r.id} className="a-store-row a-grant">
                  <div className="a-store-info">
                    <strong>
                      {stars(r.rating)} · {r.courier_name}
                    </strong>
                    {r.comment && <span>“{r.comment}”</span>}
                    <small>
                      Pedido #{r.order_id.slice(0, 6).toUpperCase()} · {when(r.created_at)}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </AdminLayout>
  );
}

import { CheckCircle2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ridesApi } from '../../features/rides/api.js';
import { FARE_PER_PERSON, people, timeOf } from '../../features/rides/model.js';
import { formatCop } from '../../lib/money.js';
import { Avatar } from '../transport/parts.jsx';

const PERIODS = [
  { id: 'today', label: 'Hoy', title: 'Ingresos de hoy' },
  { id: 'week', label: 'Semana', title: 'Ingresos de los últimos 7 días' },
  { id: 'month', label: 'Mes', title: 'Ingresos de los últimos 30 días' },
];
const hourLabel = (h) => `${Number(h) % 12 || 12}${Number(h) < 12 ? 'am' : 'pm'}`;
const dayLabel = (iso, short) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', short ? { day: 'numeric' } : { weekday: 'short', day: 'numeric' });
};

/** "Mis ganancias": hoy por hora, la semana y el mes por día, y los últimos viajes. */
export default function EarningsView() {
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null);
    ridesApi
      .earnings(period)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [period]);

  // Hoy: de 5 a. m. a 11 p. m. (las horas en que se trabaja), salvo que haya viajes de madrugada.
  const buckets = data ? (period === 'today' ? data.buckets.filter((b, n) => (n >= 5 && n <= 23) || b.rides) : data.buckets) : [];
  const max = Math.max(1, ...buckets.map((b) => b.total_cop));
  const info = PERIODS.find((p) => p.id === period);

  return (
    <div className="dr-view">
      <div className="spp-head">
        <h1>Mis ganancias</h1>
        <p>Lo que has cobrado por tus viajes terminados. La tarifa es de {formatCop(FARE_PER_PERSON)} por persona.</p>
      </div>
      <div className="htp-tabs" role="tablist">
        {PERIODS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={period === p.id} className={period === p.id ? 'on' : ''} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      {error && <p className="spp-banner bad">{error}</p>}
      {!data ? (
        <p className="sp-empty">Cargando…</p>
      ) : (
        <>
          <section className="dr-card dr-earn">
            <div className="dr-earn-total">
              <strong>{formatCop(data.total_cop)}</strong>
              <span>{info.title}</span>
            </div>
            <ul className="dr-earn-stats">
              <li>
                <CheckCircle2 size={16} aria-hidden="true" /> {data.rides === 1 ? '1 viaje completado' : `${data.rides} viajes completados`}
              </li>
              <li>
                <Users size={16} aria-hidden="true" /> {people(data.passengers)} transportadas
              </li>
              <li>Tarifa por persona: {formatCop(data.fare_per_person_cop)}</li>
            </ul>
            <div className={`dr-chart ${period}`} role="img" aria-label={`Ingresos por ${period === 'today' ? 'hora' : 'día'}`}>
              {buckets.map((b) => (
                <div key={b.label} className="dr-bar" title={`${period === 'today' ? hourLabel(b.label) : dayLabel(b.label)}: ${formatCop(b.total_cop)} (${b.rides})`}>
                  <span style={{ height: `${(b.total_cop / max) * 100}%` }} className={b.total_cop ? '' : 'zero'} />
                  <small>{period === 'today' ? (Number(b.label) % 3 === 0 ? hourLabel(b.label) : '') : period === 'week' ? dayLabel(b.label) : Number(b.label.slice(8)) % 5 === 1 ? dayLabel(b.label, true) : ''}</small>
                </div>
              ))}
            </div>
          </section>
          <section className="dr-card">
            <h2>Últimos viajes</h2>
            {data.recent.length ? (
              <ul className="dr-history">
                {data.recent.map((r) => (
                  <li key={r.id}>
                    <Avatar name={r.customer_name} size={36} />
                    <span>
                      <strong>{r.address}</strong>
                      <small>
                        {people(r.passengers)}
                        {r.rating ? ` · ${'★'.repeat(r.rating)}` : ''}
                      </small>
                    </span>
                    <span className="dr-history-fare">
                      <strong>{formatCop(r.fare_cop)}</strong>
                      <small>{period === 'today' ? timeOf(r.completed_at) : new Date(r.completed_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sp-muted">Aún no hay viajes terminados en este periodo.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

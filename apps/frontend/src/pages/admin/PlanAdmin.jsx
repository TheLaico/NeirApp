import { CheckCircle2, Loader2, MessageCircle, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { professionalsApi } from '../../features/professionals/api.js';
import { whatsappLink } from '../../features/professionals/directory.js';
import { PLAN_NAMES, dayLabel, paidUntil } from '../../features/professionals/subscription.js';
import { AVAILABLE_PLAN_IDS } from '../professional/plans.js';
import { formatCop } from '../../lib/money.js';

const day = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * "Planes de profesionales" (admin): confirma o rechaza los pagos que reportan los profesionales y activa o quita
 * planes a mano (cortesía, pago recibido por otro medio). Sin plan vigente el perfil no aparece en el directorio.
 */
export default function PlanAdmin({ onChanged }) {
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState('');
  const [chosen, setChosen] = useState({}); // plan elegido en el selector de cada profesional
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setState({ list: await professionalsApi.adminPlans(), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  // Se revisa cada minuto: así aparecen las solicitudes nuevas sin recargar la página.
  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const run = async (key, action, done) => {
    setError('');
    setNotice('');
    setBusy(key);
    try {
      await action();
      setNotice(done);
      setRejecting(null);
      setNote('');
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const pending = state.list.filter((r) => r.status.pending);

  return (
    <section className="a-card">
      <h2>Planes de profesionales {pending.length > 0 && <span className="a-count">{pending.length}</span>}</h2>
      <p className="a-card-hint">
        Confirma el pago cuando lo veas en la cuenta: el plan queda activo 30 días y el perfil se publica. Sin plan vigente el perfil no aparece en el directorio.
      </p>
      {error && (
        <p className="a-err" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="a-success" role="status">
          {notice}
        </p>
      )}
      {state.loading ? (
        <p className="a-empty">Cargando…</p>
      ) : state.error ? (
        <p className="a-err" role="alert">
          {state.error}
        </p>
      ) : (
        <>
          <h3 className="a-subtitle">Pagos por confirmar</h3>
          {pending.length === 0 ? (
            <p className="a-empty">No hay pagos por confirmar.</p>
          ) : (
            <ul className="a-store-list">
              {pending.map((row) => {
                const p = row.status.pending;
                const isBusy = busy === p.id;
                return (
                  <li key={p.id} className="a-store a-cert">
                    <div className="a-store-row">
                      <div className="a-store-info">
                        <strong>
                          {row.display_name} · Plan {p.plan_name} ({formatCop(p.price_cop)})
                        </strong>
                        <span>
                          {row.email && `${row.email} · `}
                          {p.payment_reference ? `Comprobante: ${p.payment_reference}` : 'Sin comprobante'} · pedido el {day(p.requested_at)}
                          {!row.has_profile && ' · aún no arma su perfil'}
                          {row.status.current && ` · hoy tiene ${row.status.current.plan_name}`}
                        </span>
                      </div>
                      <a className="a-btn ghost" href={whatsappLink(row.phone, `Hola ${row.display_name}, te escribimos de NeirAPP por tu plan ${p.plan_name}.`)} target="_blank" rel="noreferrer">
                        <MessageCircle size={16} aria-hidden="true" /> WhatsApp
                      </a>
                      <button type="button" className="a-btn primary" disabled={isBusy} onClick={() => run(p.id, () => professionalsApi.approvePlan(p.id), `✓ Plan ${p.plan_name} activo para ${row.display_name}.`)}>
                        {isBusy && rejecting !== p.id ? <Loader2 size={16} className="a-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                        Confirmar pago
                      </button>
                      <button
                        type="button"
                        className="a-btn danger-ghost"
                        disabled={isBusy}
                        onClick={() => {
                          setRejecting(rejecting === p.id ? null : p.id);
                          setNote('');
                        }}
                      >
                        <XCircle size={16} aria-hidden="true" /> Rechazar
                      </button>
                    </div>
                    {rejecting === p.id && (
                      <form
                        className="a-reject"
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(p.id, () => professionalsApi.rejectPlan(p.id, note), `Se rechazó el pago de ${row.display_name}.`);
                        }}
                      >
                        <label htmlFor={`plan-reject-${p.id}`}>Motivo (lo verá el profesional)</label>
                        <input id={`plan-reject-${p.id}`} value={note} maxLength={200} placeholder="Ej: No encontramos el pago con ese comprobante" onChange={(e) => setNote(e.target.value)} autoFocus />
                        <button type="submit" className="a-btn danger" disabled={isBusy || note.trim().length < 5}>
                          Enviar rechazo
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <h3 className="a-subtitle">Plan de cada profesional</h3>
          {state.list.length === 0 ? (
            <p className="a-empty">Todavía ningún profesional ha armado su perfil.</p>
          ) : (
            <ul className="a-store-list">
              {state.list.map((row) => {
                const current = row.status.current;
                const pick = chosen[row.user_id] ?? (AVAILABLE_PLAN_IDS.includes(current?.plan) ? current.plan : AVAILABLE_PLAN_IDS[0]);
                const key = `grant-${row.user_id}`;
                return (
                  <li key={row.user_id} className="a-store-row a-plan-row">
                    <div className="a-store-info">
                      <strong>{row.display_name}</strong>
                      <span>
                        {row.email && `${row.email} · `}
                        {current ? `Activo hasta el ${dayLabel(paidUntil(row.status))}` : 'Sin plan: no aparece en el directorio'}
                        {!row.has_profile && ' · aún no arma su perfil'}
                      </span>
                    </div>
                    <span className={`a-badge plan-${current ? current.plan : 'none'}`}>{current ? PLAN_NAMES[current.plan] : 'Sin plan'}</span>
                    <select aria-label={`Plan para ${row.display_name}`} value={pick} onChange={(e) => setChosen((c) => ({ ...c, [row.user_id]: e.target.value }))}>
                      {/* Solo los planes que se ofrecen hoy (ver AVAILABLE_PLAN_IDS en plans.js). */}
                      {AVAILABLE_PLAN_IDS.map((id) => (
                        <option key={id} value={id}>
                          {PLAN_NAMES[id]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="a-btn ghost"
                      disabled={busy === key}
                      onClick={() => run(key, () => professionalsApi.grantPlan(row.user_id, pick), `✓ ${row.display_name}: plan ${PLAN_NAMES[pick]} activo por 30 días.`)}
                    >
                      {busy === key && <Loader2 size={16} className="a-spin" aria-hidden="true" />}
                      {current?.plan === pick ? 'Sumar 30 días' : 'Activar 30 días'}
                    </button>
                    {current && (
                      <button
                        type="button"
                        className="a-btn danger-ghost"
                        disabled={busy === key}
                        onClick={() => {
                          if (window.confirm(`¿Quitar el plan a ${row.display_name}? Su perfil deja de aparecer en el directorio.`)) {
                            run(key, () => professionalsApi.endPlan(row.user_id), `Se quitó el plan de ${row.display_name}.`);
                          }
                        }}
                      >
                        Quitar
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

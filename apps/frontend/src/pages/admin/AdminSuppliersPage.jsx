import { CheckCircle2, Gift, Loader2, MessageCircle, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { suppliersApi } from '../../features/suppliers/api.js';
import { SUBSCRIPTION_FEE, categoryOf, dayLabel, isPaid, whatsappLink } from '../../features/suppliers/model.js';
import { formatCop } from '../../lib/money.js';
import AdminLayout from './AdminLayout.jsx';

const when = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Proveedores (admin): confirmar los pagos de suscripción ($ 24.900 al mes) y ver la suscripción de cada empresa,
 * con la opción de regalar un mes o quitarla. Las empresas se autorizan por correo en Roles (rol Proveedor).
 */
export default function AdminSuppliersPage({ user, onLogout }) {
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setState({ list: await suppliersApi.adminSubscriptions(), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const run = async (key, action, done) => {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(done);
      setRejecting(null);
      setNote('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const pending = state.list.filter((r) => r.subscription.pending);

  return (
    <AdminLayout
      user={user}
      onLogout={onLogout}
      title="Proveedores"
      subtitle="Confirma los pagos de suscripción de las empresas y revisa quién aparece en Proveedores. Autoriza nuevas empresas en Roles (rol Proveedor)."
    >
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

      <section className="a-card">
        <h2>Pagos por confirmar {pending.length > 0 && <span className="a-count">{pending.length}</span>}</h2>
        <p className="a-card-hint">La suscripción cuesta {formatCop(SUBSCRIPTION_FEE)} al mes. Al confirmar, la empresa aparece 30 días (si aún tenía tiempo, se suma al final).</p>
        {state.loading ? (
          <p className="a-empty">Cargando…</p>
        ) : state.error ? (
          <p className="a-err">{state.error}</p>
        ) : pending.length === 0 ? (
          <p className="a-empty">No hay pagos por confirmar.</p>
        ) : (
          <ul className="a-store-list">
            {pending.map(({ supplier: s, subscription: sub }) => {
              const p = sub.pending;
              return (
                <li key={p.id} className="a-store a-cert">
                  <div className="a-store-row">
                    {s.logo_url && <img className="a-mq-photo" src={s.logo_url} alt="" />}
                    <div className="a-store-info">
                      <strong>
                        {s.company_name} · {formatCop(p.amount_cop)}
                      </strong>
                      <span>
                        {p.reference ? `Comprobante: ${p.reference}` : 'Sin comprobante'} · enviado el {when(p.requested_at)}
                        {isPaid(sub.paid_until) && ` · activa hasta el ${dayLabel(sub.paid_until)}`}
                      </span>
                    </div>
                    {(s.whatsapp || s.phone) && (
                      <a className="a-btn ghost" href={s.whatsapp ? whatsappLink(s.whatsapp, s.company_name) : `tel:${s.phone}`} target="_blank" rel="noreferrer">
                        <MessageCircle size={16} aria-hidden="true" /> Contactar
                      </a>
                    )}
                    <button type="button" className="a-btn primary" disabled={busy === p.id} onClick={() => run(p.id, () => suppliersApi.approvePayment(p.id), `✓ ${s.company_name} aparece en Proveedores por 30 días.`)}>
                      {busy === p.id && rejecting !== p.id ? <Loader2 size={16} className="a-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                      Confirmar pago
                    </button>
                    <button
                      type="button"
                      className="a-btn danger-ghost"
                      disabled={busy === p.id}
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
                        run(p.id, () => suppliersApi.rejectPayment(p.id, note), `Se rechazó el pago de ${s.company_name}.`);
                      }}
                    >
                      <label htmlFor={`sp-rej-${p.id}`}>Motivo (lo verá la empresa)</label>
                      <input id={`sp-rej-${p.id}`} value={note} maxLength={200} placeholder="Ej: No encontramos el pago con ese comprobante" onChange={(e) => setNote(e.target.value)} autoFocus />
                      <button type="submit" className="a-btn danger" disabled={busy === p.id || note.trim().length < 5}>
                        Enviar rechazo
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="a-card">
        <h2>Empresas</h2>
        <p className="a-card-hint">Solo aparecen en Proveedores las que tienen la suscripción al día, no se ocultaron y su cuenta sigue autorizada como proveedor.</p>
        {!state.loading && !state.error && state.list.length === 0 && <p className="a-empty">Todavía ninguna empresa ha creado su perfil.</p>}
        {state.list.length > 0 && (
          <ul className="a-store-list">
            {state.list.map(({ supplier: s, subscription: sub, has_access: hasAccess }) => {
              const paid = isPaid(sub.paid_until);
              const visible = paid && s.is_listed && hasAccess;
              const key = `s-${s.user_id}`;
              return (
                <li key={s.user_id} className="a-store-row a-plan-row">
                  <div className="a-store-info">
                    <strong>{s.company_name}</strong>
                    <span>
                      {categoryOf(s.category).label} · {paid ? `Activa hasta el ${dayLabel(sub.paid_until)}` : sub.paid_until ? `Venció el ${dayLabel(sub.paid_until)}` : 'Sin suscripción'}
                      {!s.is_listed && ' · oculta por la empresa'}
                      {!hasAccess && ' · la cuenta no tiene el rol Proveedor (autorízala en Roles)'}
                      {!s.catalog_url && ' · sin catálogo'}
                    </span>
                  </div>
                  <span className={`a-badge ${visible ? 'plan-pro' : 'plan-none'}`}>{visible ? 'Visible' : 'No aparece'}</span>
                  <button type="button" className="a-btn ghost" disabled={busy === key} onClick={() => run(key, () => suppliersApi.grantMonth(s.user_id), `✓ ${s.company_name}: se activó un mes.`)}>
                    {busy === key ? <Loader2 size={16} className="a-spin" aria-hidden="true" /> : <Gift size={16} aria-hidden="true" />} Activar un mes
                  </button>
                  {paid && (
                    <button
                      type="button"
                      className="a-btn danger-ghost"
                      disabled={busy === key}
                      onClick={() => window.confirm(`¿Quitar la suscripción de ${s.company_name}? Deja de aparecer desde hoy.`) && run(key, () => suppliersApi.endSubscription(s.user_id), `Se quitó la suscripción de ${s.company_name}.`)}
                    >
                      Quitar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
}

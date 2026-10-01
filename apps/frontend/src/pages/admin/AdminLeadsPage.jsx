import { Building2, Phone, User } from 'lucide-react';
import { useState } from 'react';
import { usePolled } from '../../features/courier/api.js';
import { leadsApi } from '../../features/leads/api.js';
import AdminLayout from './AdminLayout.jsx';

const date = (iso) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

/** Panel de administrador: negocios que dejaron sus datos desde "Tu tienda también en NeirAPP". */
export default function AdminLeadsPage({ user, onLogout }) {
  const { data, error: loadError, loading, refresh } = usePolled(leadsApi.list, { every: 30000 });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const pending = (data ?? []).filter((l) => !l.is_contacted).length;

  const toggle = async (lead) => {
    setError('');
    setBusy(lead.id);
    try {
      await leadsApi.setContacted(lead.id, !lead.is_contacted);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminLayout
      user={user}
      onLogout={onLogout}
      title="Solicitudes"
      subtitle="Negocios que dejaron sus datos para que un asesor se ponga en contacto. Márcalos cuando ya los hayas llamado."
    >
      <section className="a-card">
        <h2>
          Negocios interesados{data ? ` (${data.length})` : ''}
          {pending > 0 && <span className="a-badge local"> {pending} por contactar</span>}
        </h2>
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
        {data?.length === 0 && <p className="a-empty">Todavía nadie ha dejado sus datos.</p>}
        {data?.length > 0 && (
          <ul className="a-store-list">
            {data.map((lead) => (
              <li key={lead.id} className="a-store-row a-grant">
                <div className="a-store-info">
                  <strong>
                    <Building2 size={16} aria-hidden="true" /> {lead.business_name}
                  </strong>
                  <span>
                    <User size={14} aria-hidden="true" /> {lead.contact_name} ·{' '}
                    <a href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}>
                      <Phone size={14} aria-hidden="true" /> {lead.phone}
                    </a>
                  </span>
                  <small>{date(lead.created_at)}</small>
                </div>
                <span className={`a-badge ${lead.is_contacted ? 'server' : 'local'}`}>{lead.is_contacted ? 'Contactado' : 'Por contactar'}</span>
                <button type="button" className="a-btn ghost" disabled={busy === lead.id} onClick={() => toggle(lead)}>
                  {lead.is_contacted ? 'Marcar pendiente' : 'Marcar contactado'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
}

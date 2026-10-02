import { Building2, CheckCircle2, ChevronDown, IdCard, Mail, Phone, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { usePolled } from '../../features/courier/api.js';
import { applicationsApi } from '../../features/leads/api.js';
import { JOIN_ROLES, joinRoleTitle } from '../../features/leads/joinRoles.js';
import { useRoleGrants } from '../../features/roles/api.js';

const date = (iso) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
const whatsapp = (phone) => {
  const d = phone.replace(/\D/g, '');
  return `https://wa.me/${d.length === 10 ? `57${d}` : d}`;
};

/**
 * Solicitudes de "¿Quieres formar parte de NeirAPP?" (pantalla de inicio de sesión): quién es, cómo contactarlo, la
 * empresa y los datos de su rol. Desde aquí se marca como contactada y se autoriza su correo con el rol que pidió
 * (lo mismo que hacer en Roles; al crear su cuenta con ese correo, entra con el rol).
 */
export default function RoleApplications() {
  const { data, error: loadError, loading, refresh } = usePolled(applicationsApi.list, { every: 30000 });
  const grants = useRoleGrants();
  const [role, setRole] = useState('');
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const granted = (a) => grants.grants.some((g) => g.email === a.email && g.role === a.role);
  const list = (data ?? []).filter((a) => !role || a.role === role);
  const pending = (data ?? []).filter((a) => !a.is_contacted).length;

  const run = async (id, fn) => {
    setError('');
    setBusy(id);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="a-card">
      <h2>
        <ShieldCheck size={18} aria-hidden="true" /> Quieren formar parte de NeirAPP{data ? ` (${data.length})` : ''}
        {pending > 0 && <span className="a-badge local"> {pending} por contactar</span>}
      </h2>
      <p className="a-empty">
        Solicitudes enviadas desde el menú de la pantalla de inicio de sesión. Contacta a la persona y, si todo está bien, autoriza su correo con el rol que pidió:
        al crear su cuenta con ese correo entra con su panel.
      </p>
      <div className="a-chips" role="group" aria-label="Filtrar por rol">
        {[{ role: '', title: 'Todas' }, ...JOIN_ROLES].map((r) => (
          <button key={r.role || 'all'} type="button" className={role === r.role ? 'on' : ''} aria-pressed={role === r.role} onClick={() => setRole(r.role)}>
            {r.title}
          </button>
        ))}
      </div>

      {loading && <p className="a-empty">Cargando…</p>}
      {(error || (loadError && !data)) && (
        <p className="a-err" role="alert">
          {error || loadError}
        </p>
      )}
      {data && list.length === 0 && <p className="a-empty">Todavía no hay solicitudes{role ? ' para este rol' : ''}.</p>}

      <ul className="a-store-list">
        {list.map((a) => (
          <li key={a.id} className="a-grant ra-item">
            <div className="a-store-row">
              <div className="a-store-info">
                <strong>{a.full_name}</strong>
                <span className="ra-role">{joinRoleTitle(a.role)}</span>
                {a.company_name && (
                  <span>
                    <Building2 size={14} aria-hidden="true" /> {a.company_name}
                    {a.company_id ? ` · ${a.company_id}` : ''}
                  </span>
                )}
                <span className="ra-contact">
                  <a href={whatsapp(a.phone)} target="_blank" rel="noreferrer">
                    <Phone size={14} aria-hidden="true" /> {a.phone}
                  </a>
                  <a href={`mailto:${a.email}`}>
                    <Mail size={14} aria-hidden="true" /> {a.email}
                  </a>
                  <span>
                    <IdCard size={14} aria-hidden="true" /> C.C. {a.document_number}
                  </span>
                </span>
                <small>{date(a.created_at)}</small>
              </div>
              <span className={`a-badge ${a.is_contacted ? 'server' : 'local'}`}>{a.is_contacted ? 'Contactado' : 'Por contactar'}</span>
              <button type="button" className="a-btn ghost" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>
                Ver datos <ChevronDown size={16} aria-hidden="true" />
              </button>
            </div>
            {open === a.id && (
              <div className="ra-details">
                <dl>
                  {Object.entries(a.details).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                {a.message && <p className="ra-message">“{a.message}”</p>}
                <div className="a-form-actions">
                  <button type="button" className="a-btn ghost" disabled={busy === a.id} onClick={() => run(a.id, () => applicationsApi.setContacted(a.id, !a.is_contacted))}>
                    {a.is_contacted ? 'Marcar pendiente' : 'Marcar contactado'}
                  </button>
                  {granted(a) ? (
                    <span className="a-badge server">
                      <CheckCircle2 size={13} aria-hidden="true" /> Correo autorizado como {joinRoleTitle(a.role).toLowerCase()}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="a-btn primary"
                      disabled={busy === a.id}
                      onClick={() =>
                        window.confirm(`¿Autorizar ${a.email} como ${joinRoleTitle(a.role).toLowerCase()}?`) && run(a.id, () => grants.grant(a.email, a.role))
                      }
                    >
                      <ShieldCheck size={16} aria-hidden="true" /> Autorizar como {joinRoleTitle(a.role).toLowerCase()}
                    </button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

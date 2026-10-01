import { Loader2, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { ASSIGNABLE_ROLES, roleLabel, useRoleGrants } from '../../features/roles/api.js';
import AdminLayout from './AdminLayout.jsx';

/** Panel de administrador: correos autorizados como repartidor o comerciante. */
export default function AdminRolesPage({ user, onLogout }) {
  const { grants, status, error: loadError, grant, revoke } = useRoleGrants();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(ASSIGNABLE_ROLES[0].value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('Escribe el correo de la persona.');
      return;
    }
    setSaving(true);
    try {
      await grant(email.trim(), role);
      setNotice(`✓ ${email.trim().toLowerCase()} quedó autorizado como ${roleLabel(role).toLowerCase()}.`);
      setEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onRevoke = async (g) => {
    if (!window.confirm(`¿Quitar el rol de ${roleLabel(g.role).toLowerCase()} a ${g.email}?`)) return;
    setError('');
    setNotice('');
    try {
      await revoke(g.email, g.role);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <AdminLayout
      user={user}
      onLogout={onLogout}
      title="Roles"
      subtitle="Autoriza correos como repartidor o comerciante. Si la persona ya tiene cuenta, recibe el rol de inmediato; si no, al registrarse."
    >
      <form className="a-card a-form" onSubmit={onSubmit} noValidate>
        <h2>Autorizar un correo</h2>
        <div className="a-grid">
          <div className="a-field">
            <label htmlFor="role-email">Correo electrónico</label>
            <input
              id="role-email"
              type="email"
              autoComplete="off"
              placeholder="persona@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="a-field">
            <label htmlFor="role-kind">Rol</label>
            <select id="role-kind" value={role} onChange={(e) => setRole(e.target.value)}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && (
          <p className="a-err" role="alert">
            {error}
          </p>
        )}
        <div className="a-form-actions">
          <button type="submit" className="a-btn primary" disabled={saving}>
            {saving ? <Loader2 size={18} className="a-spin" aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
            Autorizar
          </button>
        </div>
      </form>

      {notice && (
        <p className="a-success" role="status">
          {notice}
        </p>
      )}

      <section className="a-card">
        <h2>Correos autorizados</h2>
        {status === 'loading' && <p className="a-empty">Cargando…</p>}
        {status === 'error' && (
          <p className="a-err" role="alert">
            {loadError}
          </p>
        )}
        {status === 'ok' && grants.length === 0 && <p className="a-empty">Todavía no autorizaste ningún correo.</p>}
        {grants.length > 0 && (
          <ul className="a-store-list">
            {grants.map((g) => (
              <li key={`${g.email}:${g.role}`} className="a-store-row a-grant">
                <div className="a-store-info">
                  <strong>{g.email}</strong>
                  <span>{g.has_account ? g.full_name : 'Aún no se ha registrado'}</span>
                </div>
                <span className="a-badge server">{roleLabel(g.role)}</span>
                <span className={`a-badge ${g.has_account ? 'server' : 'local'}`}>{g.has_account ? 'Activo' : 'Pendiente'}</span>
                <button type="button" className="a-icon-btn danger" aria-label={`Quitar rol a ${g.email}`} onClick={() => onRevoke(g)}>
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
}

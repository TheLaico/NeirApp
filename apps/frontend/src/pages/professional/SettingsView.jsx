import { ChevronRight, Crown, Eye, EyeOff, KeyRound, Loader2, LogOut, Mail, Search, UserRound } from 'lucide-react';
import { useState } from 'react';
import { isMobile } from '../../features/professionals/profile.js';
import { dayLabel, paidUntil } from '../../features/professionals/subscription.js';
import { changePassword, updateProfile } from '../../services/auth.js';

const PASSWORD_MIN = 8;

// "+573157654321" → "315 765 4321", como lo escribe la gente.
const localPhone = (phone) =>
  (phone ?? '')
    .replace(/\D/g, '')
    .replace(/^57(?=\d{10}$)/, '')
    .replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');

/**
 * "Configuración" del panel del profesional: quién ve su perfil, los datos de su cuenta,
 * la contraseña, su plan y cerrar sesión. Los datos públicos del perfil se cambian en "Mi perfil".
 */
export default function SettingsView({ user, profile, published, plan, onSaveSettings, onUserChange, onGo, onPlans, onLogout }) {
  return (
    <div className="st">
      <div className="sv-head">
        <div>
          <h1>Configuración</h1>
          <p>Decide quién ve tu perfil, actualiza los datos de tu cuenta y cuida tu contraseña.</p>
        </div>
      </div>

      <VisibilityCard profile={profile} published={published} onSave={onSaveSettings} onGoProfile={() => onGo('profile')} />
      <AccountCard user={user} onUserChange={onUserChange} />
      <PasswordCard onUserChange={onUserChange} />

      <section className="pf-card st-card" aria-labelledby="st-plan">
        <h2 id="st-plan">
          <Crown size={20} aria-hidden="true" /> Tu plan
        </h2>
        <button type="button" className="st-link" onClick={onPlans}>
          <span>
            <strong>{plan?.current ? `Plan ${plan.current.plan_name}` : plan?.pending ? `Plan ${plan.pending.plan_name}: pago en revisión` : 'Sin plan activo'}</strong>
            <small>
              {plan?.current
                ? `Activo hasta el ${dayLabel(paidUntil(plan))}. Renuévalo o cámbialo en Planes para profesionales.`
                : plan?.pending
                  ? 'Te avisaremos cuando confirmemos el pago.'
                  : 'Tu perfil no aparece en el directorio hasta que actives un plan. Compara Básico, Profesional y Premium.'}
            </small>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </section>

      <section className="pf-card st-card" aria-labelledby="st-session">
        <h2 id="st-session">
          <LogOut size={20} aria-hidden="true" /> Sesión
        </h2>
        <div className="st-row">
          <span>
            <strong>Cerrar sesión en este dispositivo</strong>
            <small>Tu perfil y tus servicios quedan guardados.</small>
          </span>
          <button type="button" className="cr-btn ghost danger-text" onClick={onLogout}>
            <LogOut size={17} aria-hidden="true" /> Cerrar sesión
          </button>
        </div>
      </section>
    </div>
  );
}

/** Mostrar el perfil en el directorio: se guarda al tocar el interruptor. */
function VisibilityCard({ profile, published, onSave, onGoProfile }) {
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState({ text: '', bad: false });

  if (!published) {
    return (
      <section className="pf-card st-card" aria-labelledby="st-visibility">
        <h2 id="st-visibility">
          <Search size={20} aria-hidden="true" /> Visibilidad
        </h2>
        <div className="st-row">
          <span>
            <strong>Todavía no has publicado tu perfil</strong>
            <small>Cuando lo publiques podrás ocultarlo desde aquí.</small>
          </span>
          <button type="button" className="cr-btn primary" onClick={onGoProfile}>
            Armar mi perfil
          </button>
        </div>
      </section>
    );
  }

  const toggle = async (key) => {
    const next = { listed: profile.listed, [key]: !profile[key] };
    setSaving(key);
    setNotice({ text: '', bad: false });
    try {
      await onSave(next);
      const text = next.listed
        ? 'Tu perfil vuelve a aparecer en el directorio.'
        : 'Tu perfil quedó oculto. Nadie lo verá hasta que lo vuelvas a mostrar.';
      setNotice({ text, bad: false });
    } catch (err) {
      setNotice({ text: err.message, bad: true });
    } finally {
      setSaving('');
    }
  };

  const options = [
    {
      key: 'listed',
      Icon: Search,
      label: 'Mostrar mi perfil en el directorio',
      on: 'Las personas te encuentran en Profesionales y pueden ver tu perfil.',
      off: 'Tu perfil está oculto: nadie lo ve ni te puede contactar desde NeirAPP. Útil si sales de vacaciones.',
    },
  ];

  return (
    <section className="pf-card st-card" aria-labelledby="st-visibility">
      <h2 id="st-visibility">
        <Search size={20} aria-hidden="true" /> Visibilidad
      </h2>
      <ul className="st-switches">
        {options.map(({ key, Icon, label, on, off }) => {
          const value = profile[key];
          const disabled = Boolean(saving);
          return (
            <li key={key} className={disabled && saving !== key ? 'muted' : ''}>
              <span className={`st-ico${value ? ' on' : ''}`}>
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="st-text">
                <strong id={`st-${key}`}>{label}</strong>
                <small>{value ? on : off}</small>
              </span>
              {saving === key ? (
                <Loader2 size={22} className="cr-spin st-spin" aria-label="Guardando" />
              ) : (
                <button type="button" role="switch" aria-checked={value} aria-labelledby={`st-${key}`} className={`a-switch${value ? ' on' : ''}`} disabled={disabled} onClick={() => toggle(key)}>
                  <span />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {notice.text && (
        <p className={`sv-notice${notice.bad ? ' bad' : ''}`} role="status">
          {notice.text}
        </p>
      )}
    </section>
  );
}

/** Nombre y celular de la cuenta (con los que entra a NeirAPP). El correo no se cambia desde aquí. */
function AccountCard({ user, onUserChange }) {
  const [form, setForm] = useState({ name: user.name ?? '', phone: localPhone(user.phone) });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(''); // '', 'saving', 'saved'
  const changed = form.name.trim() !== (user.name ?? '') || form.phone.replace(/\D/g, '') !== localPhone(user.phone).replace(/\D/g, '');

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors({});
    setStatus('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (form.name.trim().length < 2) found.name = 'Escribe tu nombre.';
    if (!isMobile(form.phone)) found.phone = 'Escribe un celular de 10 dígitos, por ejemplo 310 123 4567.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setStatus('saving');
    try {
      const updated = await updateProfile(user.id, { name: form.name, phone: form.phone });
      onUserChange?.(updated);
      setForm({ name: updated.name, phone: localPhone(updated.phone) });
      setStatus('saved');
    } catch (err) {
      setErrors({ server: err.message });
      setStatus('');
    }
  };

  return (
    <section className="pf-card st-card" aria-labelledby="st-account">
      <h2 id="st-account">
        <UserRound size={20} aria-hidden="true" /> Tu cuenta
      </h2>
      <form className="pf st-form" onSubmit={submit} noValidate>
        <div className="pf-grid">
          <label>
            Nombre
            <input value={form.name} maxLength={120} autoComplete="name" aria-invalid={Boolean(errors.name)} onChange={(e) => set({ name: e.target.value })} />
            {errors.name && <small className="pf-error">{errors.name}</small>}
          </label>
          <label>
            Celular
            <input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} placeholder="310 123 4567" aria-invalid={Boolean(errors.phone)} onChange={(e) => set({ phone: e.target.value })} />
            {errors.phone && <small className="pf-error">{errors.phone}</small>}
          </label>
          <div className="pf-wide st-email">
            <Mail size={18} aria-hidden="true" />
            <span>
              <strong>{user.email}</strong>
              <small>Es el correo con el que entras y el que autorizó el administrador; no se puede cambiar.</small>
            </span>
          </div>
        </div>
        <p className="pf-help st-hint">Estos son los datos de tu cuenta. Lo que ven los clientes (nombre con título, celular y WhatsApp) lo cambias en Mi perfil.</p>
        {errors.server && (
          <p className="pf-error" role="alert">
            {errors.server}
          </p>
        )}
        <div className="st-actions">
          {status === 'saved' && (
            <span className="st-ok" role="status">
              Datos guardados.
            </span>
          )}
          <button type="submit" className="cr-btn primary" disabled={!changed || status === 'saving'}>
            {status === 'saving' && <Loader2 size={17} className="cr-spin" aria-hidden="true" />} Guardar cambios
          </button>
        </div>
      </form>
    </section>
  );
}

/** Cambiar la contraseña: pide la actual y la nueva dos veces. Las otras sesiones abiertas se cierran. */
function PasswordCard({ onUserChange }) {
  const empty = { current: '', next: '', confirm: '' };
  const [form, setForm] = useState(empty);
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('');

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors({});
    setStatus('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!form.current) found.current = 'Escribe tu contraseña actual.';
    if (form.next.length < PASSWORD_MIN) found.next = `La nueva debe tener al menos ${PASSWORD_MIN} caracteres.`;
    else if (form.next === form.current) found.next = 'La nueva debe ser distinta de la actual.';
    if (!found.next && form.confirm !== form.next) found.confirm = 'Las contraseñas no coinciden.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setStatus('saving');
    try {
      onUserChange?.(await changePassword({ current: form.current, next: form.next }));
      setForm(empty);
      setShow(false);
      setStatus('saved');
    } catch (err) {
      const field = { wrong_current_password: 'current', weak_password: 'next', same_password: 'next' }[err.code];
      setErrors(field ? { [field]: err.message } : { server: err.message });
      setStatus('');
    }
  };

  const type = show ? 'text' : 'password';

  return (
    <section className="pf-card st-card" aria-labelledby="st-password">
      <h2 id="st-password">
        <KeyRound size={20} aria-hidden="true" /> Contraseña
      </h2>
      <form className="pf st-form" onSubmit={submit} noValidate>
        <div className="pf-grid">
          <label className="pf-wide st-current">
            Contraseña actual
            <input type={type} value={form.current} autoComplete="current-password" aria-invalid={Boolean(errors.current)} onChange={(e) => set({ current: e.target.value })} />
            {errors.current && <small className="pf-error">{errors.current}</small>}
          </label>
          <label>
            Contraseña nueva
            <input type={type} value={form.next} maxLength={128} autoComplete="new-password" aria-invalid={Boolean(errors.next)} onChange={(e) => set({ next: e.target.value })} />
            {errors.next ? <small className="pf-error">{errors.next}</small> : <small className="pf-help">Mínimo {PASSWORD_MIN} caracteres.</small>}
          </label>
          <label>
            Repite la contraseña nueva
            <input type={type} value={form.confirm} maxLength={128} autoComplete="new-password" aria-invalid={Boolean(errors.confirm)} onChange={(e) => set({ confirm: e.target.value })} />
            {errors.confirm && <small className="pf-error">{errors.confirm}</small>}
          </label>
        </div>
        {errors.server && (
          <p className="pf-error" role="alert">
            {errors.server}
          </p>
        )}
        <div className="st-actions">
          <button type="button" className="st-show" aria-pressed={show} onClick={() => setShow((s) => !s)}>
            {show ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />} {show ? 'Ocultar' : 'Mostrar'} contraseñas
          </button>
          {status === 'saved' && (
            <span className="st-ok" role="status">
              Contraseña cambiada. Cerramos tu sesión en los demás dispositivos.
            </span>
          )}
          <button type="submit" className="cr-btn primary" disabled={status === 'saving' || !form.current || !form.next}>
            {status === 'saving' && <Loader2 size={17} className="cr-spin" aria-hidden="true" />} Cambiar contraseña
          </button>
        </div>
      </form>
    </section>
  );
}

import { ArrowLeft, CheckCircle2, ChevronRight, Loader2, Menu, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { applicationsApi } from '../../features/leads/api.js';
import { JOIN_ROLES } from '../../features/leads/joinRoles.js';
import './join.css';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const digits = (t) => t.replace(/\D/g, '');

/** Cierra con Escape y bloquea el scroll de la página mientras está abierto. */
function useOverlay(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);
}

/**
 * Menú de hamburguesa de la pantalla de inicio de sesión: "¿Quieres formar parte de NeirAPP?". Lista los roles a los
 * que se puede pedir entrar y abre el formulario de solicitud de cada uno (no hace falta tener cuenta).
 */
export default function JoinMenu() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null); // null: cerrado · '': elegir rol · 'courier'…: ese rol

  const close = () => setOpen(false);
  useOverlay(open && form === null, close);

  const start = (role) => {
    setOpen(false);
    setForm(role);
  };

  return (
    <>
      <button type="button" className="join-burger" aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen(true)}>
        <Menu size={24} aria-hidden="true" />
      </button>

      {createPortal(
        <div className={`join-drawer-wrap${open ? ' open' : ''}`} aria-hidden={!open}>
          <div className="join-scrim" onClick={close} />
          <aside className="join-drawer" role="dialog" aria-modal="true" aria-labelledby="join-title" inert={open ? undefined : ''}>
            <div className="join-drawer-head">
              <strong>Menú</strong>
              <button type="button" className="join-close" aria-label="Cerrar menú" onClick={close}>
                <X size={22} aria-hidden="true" />
              </button>
            </div>

            <section className="join-hero">
              <h2 id="join-title">¿Quieres formar parte de NeirAPP?</h2>
              <p>Elige cómo quieres trabajar con nosotros y manda una solicitud. Te contactamos para conocerte y activar tu cuenta.</p>
              <button type="button" className="join-cta" onClick={() => start('')}>
                <Send size={18} aria-hidden="true" /> Manda una solicitud
              </button>
            </section>

            <ul className="join-roles">
              {JOIN_ROLES.map(({ role, title, text, Icon, color }) => (
                <li key={role}>
                  <button type="button" className="join-role" onClick={() => start(role)}>
                    <span className="join-role-ico" style={{ background: color }}>
                      <Icon size={20} color="#fff" aria-hidden="true" />
                    </span>
                    <span className="join-role-text">
                      <strong>{title}</strong>
                      <small>{text}</small>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>,
        document.body,
      )}

      {form !== null && createPortal(<JoinForm initialRole={form} onClose={() => setForm(null)} />, document.body)}
    </>
  );
}

const EMPTY = { full_name: '', document_number: '', phone: '', email: '', company_name: '', company_id: '', message: '', website: '' };

function JoinForm({ initialRole, onClose }) {
  const [role, setRole] = useState(initialRole);
  const [values, setValues] = useState(EMPTY);
  const [details, setDetails] = useState({});
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  useOverlay(true, onClose);

  const config = JOIN_ROLES.find((r) => r.role === role);
  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };
  const setDetail = (label) => (e) => {
    setDetails((d) => ({ ...d, [label]: e.target.value }));
    setErrors((er) => ({ ...er, [label]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (values.full_name.trim().length < 2) next.full_name = 'Escribe tu nombre completo.';
    const doc = digits(values.document_number).length;
    if (doc < 5 || doc > 15) next.document_number = 'Escribe tu número de cédula.';
    const phone = digits(values.phone).length;
    if (phone < 7 || phone > 15) next.phone = 'Escribe un celular válido.';
    if (!EMAIL.test(values.email.trim())) next.email = 'Escribe un correo válido.';
    if (config.company.required && values.company_name.trim().length < 2) next.company_name = 'Este dato es obligatorio.';
    for (const f of config.fields) if (f.required && !(details[f.label] ?? '').trim()) next[f.label] = 'Este dato es obligatorio.';
    if (!consent) next.consent = 'Necesitamos tu autorización para contactarte.';
    return next;
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) {
      setFormError('Revisa los campos marcados.');
      // Lleva al primer campo con error (el formulario es largo y el botón queda al final).
      setTimeout(() => document.querySelector('.join-form .invalid')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
      return;
    }
    setFormError('');
    setSending(true);
    try {
      // Solo se envían los datos propios del rol elegido (si cambió de rol, los del anterior no van).
      const own = Object.fromEntries(config.fields.map((f) => [f.label, (details[f.label] ?? '').trim()]).filter(([, v]) => v));
      await applicationsApi.submit({ ...values, role, details: own });
      setSent(true);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSending(false);
    }
  };

  const field = (key, label, props = {}) => (
    <label className={`join-field${errors[key] ? ' invalid' : ''}`}>
      <span>
        {label}
        {props.required === false && <em> (opcional)</em>}
      </span>
      <input value={values[key]} onChange={set(key)} {...props} required={undefined} aria-invalid={Boolean(errors[key])} />
      {errors[key] && <small>{errors[key]}</small>}
    </label>
  );

  let body;
  if (sent) {
    body = (
      <div className="join-done">
        <CheckCircle2 size={56} aria-hidden="true" />
        <h2>¡Recibimos tu solicitud!</h2>
        <p>
          Te contactaremos al <strong>{values.phone}</strong> para conocerte. Cuando quede aprobada, crea tu cuenta con el correo{' '}
          <strong>{values.email.trim().toLowerCase()}</strong> y tendrás tu panel de {config.title.toLowerCase()}.
        </p>
        <button type="button" className="join-submit" onClick={onClose}>
          Entendido
        </button>
      </div>
    );
  } else if (!config) {
    body = (
      <>
        <p className="join-lead">¿Cómo quieres formar parte de NeirAPP?</p>
        <ul className="join-roles grid">
          {JOIN_ROLES.map(({ role: r, title, text, Icon, color }) => (
            <li key={r}>
              <button type="button" className="join-role" onClick={() => setRole(r)}>
                <span className="join-role-ico" style={{ background: color }}>
                  <Icon size={20} color="#fff" aria-hidden="true" />
                </span>
                <span className="join-role-text">
                  <strong>{title}</strong>
                  <small>{text}</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  } else {
    body = (
      <form className="join-form" onSubmit={submit} noValidate>
        <div className="join-chosen" style={{ '--tint': config.color }}>
          <span className="join-role-ico" style={{ background: config.color }}>
            <config.Icon size={20} color="#fff" aria-hidden="true" />
          </span>
          <span>
            <strong>{config.title}</strong>
            <small>{config.text}</small>
          </span>
          <button type="button" className="join-change" onClick={() => setRole('')}>
            Cambiar
          </button>
        </div>

        <fieldset>
          <legend>¿Quién eres?</legend>
          {field('full_name', 'Nombre completo', { autoComplete: 'name', maxLength: 80 })}
          <div className="join-row">
            {field('document_number', 'Número de cédula', { inputMode: 'numeric', maxLength: 20 })}
            {field('phone', 'Celular / WhatsApp', { type: 'tel', autoComplete: 'tel', maxLength: 20 })}
          </div>
          {field('email', 'Correo electrónico', { type: 'email', autoComplete: 'email', maxLength: 254 })}
          <p className="join-hint">Con este correo crearás tu cuenta cuando aprobemos tu solicitud.</p>
        </fieldset>

        <fieldset>
          <legend>{config.company.required ? 'Tu empresa' : 'Empresa'}</legend>
          {field('company_name', config.company.label, { maxLength: 120, required: config.company.required ? undefined : false })}
          {(config.company.required || values.company_name.trim()) &&
            field('company_id', config.company.idLabel ?? 'NIT (si tiene)', { maxLength: 40, required: false })}
        </fieldset>

        <fieldset>
          <legend>Sobre ti como {config.title.toLowerCase()}</legend>
          {config.fields.map((f) => (
            <label key={f.label} className={`join-field${errors[f.label] ? ' invalid' : ''}`}>
              <span>
                {f.label}
                {!f.required && <em> (opcional)</em>}
              </span>
              {f.type === 'select' ? (
                <select value={details[f.label] ?? ''} onChange={setDetail(f.label)} aria-invalid={Boolean(errors[f.label])}>
                  <option value="">Elige…</option>
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={details[f.label] ?? ''}
                  onChange={setDetail(f.label)}
                  placeholder={f.placeholder}
                  inputMode={f.type === 'number' ? 'numeric' : undefined}
                  maxLength={f.type === 'number' ? 5 : 200}
                  aria-invalid={Boolean(errors[f.label])}
                />
              )}
              {errors[f.label] && <small>{errors[f.label]}</small>}
            </label>
          ))}
          <label className="join-field">
            <span>
              ¿Algo más que debamos saber? <em>(opcional)</em>
            </span>
            <textarea rows={3} maxLength={600} value={values.message} onChange={set('message')} />
          </label>
        </fieldset>

        {/* Trampa para bots: invisible para las personas; si llega llena, la API no guarda la solicitud. */}
        <input className="join-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={values.website} onChange={set('website')} />

        <label className={`join-consent${errors.consent ? ' invalid' : ''}`}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>Autorizo a NeirAPP a usar estos datos para revisar mi solicitud y contactarme.</span>
        </label>

        {formError && (
          <p className="join-error" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" className="join-submit" disabled={sending}>
          {sending ? <Loader2 size={18} className="join-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
          Enviar solicitud
        </button>
      </form>
    );
  }

  return (
    <div className="join-modal-wrap">
      <div className="join-scrim" onClick={onClose} />
      <section className="join-modal" role="dialog" aria-modal="true" aria-labelledby="join-form-title">
        <header className="join-modal-head">
          {config && !sent && initialRole === '' ? (
            <button type="button" className="join-close" aria-label="Elegir otro rol" onClick={() => setRole('')}>
              <ArrowLeft size={22} aria-hidden="true" />
            </button>
          ) : (
            <span />
          )}
          <h2 id="join-form-title">Formar parte de NeirAPP</h2>
          <button type="button" className="join-close" aria-label="Cerrar" onClick={onClose}>
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        <div className="join-modal-body">{body}</div>
      </section>
    </div>
  );
}

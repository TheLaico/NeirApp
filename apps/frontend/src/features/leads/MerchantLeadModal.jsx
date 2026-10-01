import { CheckCircle2, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { leadsApi } from './api.js';
import './lead-modal.css';

const EMPTY = { contact_name: '', business_name: '', phone: '' };

/** Formulario para que un negocio deje sus datos y un asesor de NeirAPP lo contacte. */
export default function MerchantLeadModal({ onClose, defaultName = '' }) {
  const [form, setForm] = useState({ ...EMPTY, contact_name: defaultName });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const firstField = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (form.contact_name.trim().length < 2) next.contact_name = 'Escribe tu nombre.';
    if (form.business_name.trim().length < 2) next.business_name = 'Escribe el nombre de tu empresa o negocio.';
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) next.phone = 'Escribe un teléfono válido para llamarte.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await leadsApi.submit(form);
      setDone(true);
    } catch (err) {
      setFormError(err.message || 'No pudimos enviar tus datos. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lead-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lead-modal" role="dialog" aria-modal="true" aria-labelledby="lead-title">
        <button type="button" className="lead-close" onClick={onClose} aria-label="Cerrar">
          <X size={20} aria-hidden="true" />
        </button>

        {done ? (
          <div className="lead-done" role="status">
            <CheckCircle2 size={52} aria-hidden="true" />
            <h2 id="lead-title">¡Recibimos tus datos!</h2>
            <p>Un asesor de NeirAPP se pondrá en contacto contigo muy pronto.</p>
            <button type="button" className="lead-btn" onClick={onClose}>
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h2 id="lead-title">Tu tienda también en NeirAPP</h2>
            <p className="lead-sub">Deja tu información para que un asesor se ponga en contacto contigo.</p>

            <div className="lead-field">
              <label htmlFor="lead-name">Tu nombre</label>
              <input id="lead-name" ref={firstField} value={form.contact_name} onChange={set('contact_name')} autoComplete="name" maxLength={80} aria-invalid={Boolean(errors.contact_name)} />
              {errors.contact_name && <small role="alert">{errors.contact_name}</small>}
            </div>
            <div className="lead-field">
              <label htmlFor="lead-business">Nombre de la empresa</label>
              <input id="lead-business" value={form.business_name} onChange={set('business_name')} autoComplete="organization" maxLength={80} aria-invalid={Boolean(errors.business_name)} />
              {errors.business_name && <small role="alert">{errors.business_name}</small>}
            </div>
            <div className="lead-field">
              <label htmlFor="lead-phone">Teléfono de contacto</label>
              <input id="lead-phone" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" maxLength={20} placeholder="300 123 4567" aria-invalid={Boolean(errors.phone)} />
              {errors.phone && <small role="alert">{errors.phone}</small>}
            </div>

            {formError && (
              <p className="lead-error" role="alert">
                {formError}
              </p>
            )}
            <button type="submit" className="lead-btn" disabled={busy}>
              {busy && <Loader2 size={18} className="lead-spin" aria-hidden="true" />}
              Enviar mis datos
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

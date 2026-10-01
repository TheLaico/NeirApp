import { CalendarCheck, CheckCircle2, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { professionalsApi } from '../../features/professionals/api.js';
import { MESSAGE_MAX, MODALITIES, TIME_SLOTS, todayIso } from '../../features/professionals/appointments.js';
import { priceLabel } from '../../features/professionals/services.js';
import { useNavigate } from '../../lib/router.jsx';

/**
 * Ventana para pedirle una cita a un profesional desde su perfil: servicio, cómo quiere que lo atienda, cuándo le
 * queda bien y qué necesita. El profesional la recibe en "Citas y solicitudes" y responde con fecha y hora.
 */
export default function RequestDialog({ profile, services, user, onClose }) {
  const navigate = useNavigate();
  const offered = Object.keys(MODALITIES).filter((k) => profile.modalities[k]);
  const [form, setForm] = useState({
    serviceId: '',
    modality: offered[0] ?? 'office',
    date: '',
    time: 'any',
    message: '',
    address: '',
    // El celular de la cuenta puede venir como "+573157654321": se muestra como "315 765 4321".
    phone: (user.phone ?? '').replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '').replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3'),
  });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const dialog = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector('select, input, textarea')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      delete next.server;
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (form.message.trim().length < 10) found.message = 'Cuéntale qué necesitas (al menos 10 letras).';
    if (form.modality === 'home' && form.address.trim().length < 5) found.address = 'Escribe la dirección para la visita.';
    if (!/^3\d{9}$/.test(form.phone.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, ''))) found.phone = 'Escribe un celular de 10 dígitos para que te pueda contactar.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setSending(true);
    try {
      await professionalsApi.sendRequest(profile.user_id, {
        modality: form.modality,
        message: form.message.trim(),
        phone: form.phone,
        preferred_date: form.date || null,
        preferred_time: form.time,
        address: form.modality === 'home' ? form.address.trim() : '',
        service_id: form.serviceId || null,
      });
      setSent(true);
    } catch (err) {
      setErrors({ server: err.message });
    } finally {
      setSending(false);
    }
  };

  const firstName = profile.full_name.split(' ')[0];

  return (
    <div className="rd-scrim" onClick={onClose}>
      <div ref={dialog} className="rd" role="dialog" aria-modal="true" aria-labelledby="rd-title" onClick={(e) => e.stopPropagation()}>
        <div className="rd-head">
          <h2 id="rd-title">{sent ? '¡Solicitud enviada!' : `Pedir una cita con ${profile.display_name}`}</h2>
          <button type="button" className="rd-close" aria-label="Cerrar" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {sent ? (
          <div className="rd-done">
            <CheckCircle2 size={52} aria-hidden="true" />
            <p>
              {firstName} recibió tu solicitud. Cuando la acepte te contará la fecha y la hora, o te escribirá al <b>{form.phone}</b>.
            </p>
            <div className="rd-actions">
              <button type="button" className="cr-btn ghost" onClick={onClose}>
                Seguir viendo el perfil
              </button>
              <button type="button" className="cr-btn primary" onClick={() => navigate('/profesionales/mis-solicitudes')}>
                Ver mis solicitudes
              </button>
            </div>
          </div>
        ) : (
          <form className="rd-form" onSubmit={submit} noValidate>
            {services.length > 0 && (
              <label>
                Servicio <span className="sv-optional">(opcional)</span>
                <select value={form.serviceId} onChange={(e) => set({ serviceId: e.target.value })}>
                  <option value="">No sé todavía / otro</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {priceLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {offered.length > 1 && (
              <fieldset>
                <legend>¿Cómo quieres que te atienda?</legend>
                <div className="rd-chips" role="radiogroup">
                  {offered.map((key) => {
                    const { short, Icon } = MODALITIES[key];
                    return (
                      <button key={key} type="button" role="radio" aria-checked={form.modality === key} className={form.modality === key ? 'on' : ''} onClick={() => set({ modality: key })}>
                        <Icon size={16} aria-hidden="true" /> {short}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {form.modality === 'home' && (
              <label>
                Dirección para la visita
                <input value={form.address} maxLength={160} placeholder="Ej: Carrera 9 # 10-30, barrio El Carmen" aria-invalid={Boolean(errors.address)} onChange={(e) => set({ address: e.target.value })} />
                {errors.address && <small className="pf-error">{errors.address}</small>}
              </label>
            )}

            <div className="rd-row">
              <label>
                <span>
                  Día que prefieres <span className="sv-optional">(opcional)</span>
                </span>
                <input type="date" min={todayIso()} value={form.date} onChange={(e) => set({ date: e.target.value })} />
              </label>
              <label>
                Horario
                <select value={form.time} onChange={(e) => set({ time: e.target.value })}>
                  {TIME_SLOTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              ¿Qué necesitas?
              <textarea className="cr-textarea" rows={4} maxLength={MESSAGE_MAX} value={form.message} placeholder={`Cuéntale a ${firstName} tu caso en pocas palabras…`} aria-invalid={Boolean(errors.message)} onChange={(e) => set({ message: e.target.value })} />
              <small className="pf-count">
                {form.message.length}/{MESSAGE_MAX}
              </small>
              {errors.message && <small className="pf-error">{errors.message}</small>}
            </label>

            <label>
              Tu celular
              <input type="tel" inputMode="tel" value={form.phone} placeholder="310 123 4567" aria-invalid={Boolean(errors.phone)} onChange={(e) => set({ phone: e.target.value })} />
              {errors.phone ? <small className="pf-error">{errors.phone}</small> : <small className="pf-help">Solo lo verá {firstName}, para confirmarte la cita.</small>}
            </label>

            {errors.server && (
              <p className="pf-error" role="alert">
                {errors.server}
              </p>
            )}
            <div className="rd-actions">
              <button type="button" className="cr-btn ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="cr-btn primary" disabled={sending}>
                {sending ? <Loader2 size={18} className="cr-spin" aria-hidden="true" /> : <CalendarCheck size={18} aria-hidden="true" />}
                Enviar solicitud
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

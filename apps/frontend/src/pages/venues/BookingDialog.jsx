import { CalendarCheck, CheckCircle2, Loader2, Minus, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { addDays, dateLabel, isoDay, phoneLabel } from '../../features/lodging/model.js';
import { venuesApi } from '../../features/venues/api.js';
import { dayName, priceLabel, scheduleLabel, slotsFor, timeLabel } from '../../features/venues/model.js';

const MAX_DAYS = 180;

/** Las horas que todavía se pueden reservar ese día (si es hoy, solo las que no han pasado). */
function openSlots(venue, iso) {
  const now = new Date();
  const today = isoDay(now);
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return slotsFor(venue, iso).filter((t) => iso !== today || t > current);
}

/** El primer día (desde hoy) en que el lugar atiende y aún quedan horas. */
function firstOpenDay(venue) {
  let day = isoDay(new Date());
  for (let i = 0; i < 14; i += 1, day = addDays(day, 1)) if (openSlots(venue, day).length) return day;
  return isoDay(new Date());
}

/**
 * Solicitud de reserva: fecha, hora (solo las del horario del lugar), personas y celular. El lugar la confirma o la
 * rechaza; NeirAPP no cobra.
 */
export default function BookingDialog({ user, venue, onClose, onDone }) {
  const today = isoDay(new Date());
  const [form, setForm] = useState(() => {
    const day = firstOpenDay(venue);
    const slots = openSlots(venue, day);
    return { day, at: slots.includes('19:00') ? '19:00' : (slots[0] ?? ''), people: Math.min(2, venue.max_people), phone: phoneLabel(user.phone ?? ''), message: '' };
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const slots = useMemo(() => (form.day ? openSlots(venue, form.day) : []), [venue, form.day]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (patch) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      if (patch.day !== undefined) {
        const options = openSlots(venue, next.day);
        if (!options.includes(next.at)) next.at = options[0] ?? '';
      }
      return next;
    });
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.day || !form.at) return setError('Elige un día y una hora en que el lugar atienda.');
    const digits = form.phone.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
    if (!/^3\d{9}$/.test(digits)) return setError('Escribe tu celular de 10 dígitos para que el lugar te contacte.');
    setBusy(true);
    try {
      setDone(await venuesApi.book(venue.id, { ...form, phone: digits }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lg-scrim" onClick={onClose}>
      <div className="lg-dialog" role="dialog" aria-modal="true" aria-labelledby="vn-book-title" onClick={(e) => e.stopPropagation()}>
        <div className="lg-dialog-head">
          {venue.photos[0] && <img src={venue.photos[0]} alt="" />}
          <div>
            <h2 id="vn-book-title">{done ? '¡Solicitud enviada!' : 'Hacer reserva'}</h2>
            <p>{venue.name}</p>
          </div>
          <button type="button" className="lg-close" aria-label="Cerrar" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {done ? (
          <div className="lg-done">
            <CheckCircle2 size={48} aria-hidden="true" />
            <p>
              Le pediste a <strong>{venue.name}</strong> una reserva para el <strong>{dateLabel(done.day, { weekday: 'long', day: 'numeric', month: 'long' })}</strong> a las{' '}
              <strong>{timeLabel(done.at)}</strong> ({done.people === 1 ? '1 persona' : `${done.people} personas`}). Te avisaremos cuando el lugar confirme; también pueden llamarte al{' '}
              {phoneLabel(done.phone)}.
            </p>
            <div className="lg-dialog-actions">
              <button type="button" className="lg-btn outline" onClick={onClose}>
                Seguir viendo lugares
              </button>
              <button type="button" className="lg-btn primary" onClick={onDone}>
                Ver mis reservas
              </button>
            </div>
          </div>
        ) : (
          <form className="lg-form" onSubmit={submit} noValidate>
            <p className="vn-schedule">Horario: {scheduleLabel(venue)}</p>
            <div className="lg-grid2">
              <label className="lg-field">
                Día
                <input type="date" value={form.day} min={today} max={addDays(today, MAX_DAYS)} onChange={(e) => set({ day: e.target.value })} required />
              </label>
              <label className="lg-field">
                Hora
                <select value={form.at} onChange={(e) => set({ at: e.target.value })} disabled={!slots.length}>
                  {slots.length === 0 && <option value="">Sin horas</option>}
                  {slots.map((t) => (
                    <option key={t} value={t}>
                      {timeLabel(t)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {form.day && slots.length === 0 && <p className="lg-error">El {dayName(form.day)} {form.day === today ? 'ya no quedan horas' : 'no atienden'}. Elige otro día.</p>}
            <div className="lg-counter">
              <span>Personas</span>
              <div>
                <button type="button" aria-label="Menos personas" disabled={form.people <= 1} onClick={() => set({ people: form.people - 1 })}>
                  <Minus size={16} aria-hidden="true" />
                </button>
                <strong aria-live="polite">{form.people}</strong>
                <button type="button" aria-label="Más personas" disabled={form.people >= venue.max_people} onClick={() => set({ people: form.people + 1 })}>
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
            <small className="lg-muted">Este lugar recibe hasta {venue.max_people} personas por reserva.</small>
            <label className="lg-field">
              Tu celular
              <input type="tel" inputMode="tel" value={form.phone} placeholder="310 123 4567" onChange={(e) => set({ phone: e.target.value })} />
            </label>
            <label className="lg-field">
              <span>
                Mensaje para el lugar <span className="lg-optional">(opcional)</span>
              </span>
              <textarea rows={3} maxLength={500} value={form.message} placeholder="Ej: Es un cumpleaños, necesitamos silla para bebé…" onChange={(e) => set({ message: e.target.value })} />
            </label>
            <div className="lg-summary">
              <span>{priceLabel(venue)}</span>
              <small>El lugar te confirma la disponibilidad y el valor. NeirAPP no cobra la reserva.</small>
            </div>
            {error && (
              <p className="lg-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="lg-btn primary wide" disabled={busy || !slots.length}>
              {busy ? <Loader2 size={18} className="lg-spin" aria-hidden="true" /> : <CalendarCheck size={18} aria-hidden="true" />} Enviar solicitud
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

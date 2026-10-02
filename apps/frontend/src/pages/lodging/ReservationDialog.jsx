import { CalendarCheck, CheckCircle2, Loader2, Minus, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { lodgingApi } from '../../features/lodging/api.js';
import { addDays, dateLabel, isoDay, nightsBetween, phoneLabel } from '../../features/lodging/model.js';
import { formatCop } from '../../lib/money.js';

const MAX_NIGHTS = 60;

function Counter({ label, value, min, max, onChange }) {
  return (
    <div className="lg-counter">
      <span>{label}</span>
      <div>
        <button type="button" aria-label={`Menos ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <Minus size={16} aria-hidden="true" />
        </button>
        <strong aria-live="polite">{value}</strong>
        <button type="button" aria-label={`Más ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * Solicitud de reserva: fechas, huéspedes, habitaciones y celular. NeirAPP no cobra; el hotel la confirma o la
 * rechaza y el pago se acuerda con él.
 */
export default function ReservationDialog({ user, hotel, onClose, onDone }) {
  const today = isoDay(new Date());
  const [form, setForm] = useState({ check_in: addDays(today, 1), check_out: addDays(today, 2), guests: 2, rooms: 1, phone: phoneLabel(user.phone ?? ''), message: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (patch) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      // La salida siempre después de la llegada.
      if (patch.check_in && next.check_out <= next.check_in) next.check_out = addDays(next.check_in, 1);
      return next;
    });
    setError('');
  };
  const nights = form.check_in && form.check_out ? nightsBetween(form.check_in, form.check_out) : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.check_in || !form.check_out || nights < 1) return setError('Elige la fecha de llegada y de salida.');
    if (nights > MAX_NIGHTS) return setError(`Puedes reservar hasta ${MAX_NIGHTS} noches.`);
    const digits = form.phone.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
    if (!/^3\d{9}$/.test(digits)) return setError('Escribe tu celular de 10 dígitos para que el hotel te contacte.');
    setBusy(true);
    try {
      setDone(await lodgingApi.reserve(hotel.id, { ...form, phone: digits }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lg-scrim" onClick={onClose}>
      <div className="lg-dialog" role="dialog" aria-modal="true" aria-labelledby="lg-res-title" onClick={(e) => e.stopPropagation()}>
        <div className="lg-dialog-head">
          {hotel.photos[0] && <img src={hotel.photos[0]} alt="" />}
          <div>
            <h2 id="lg-res-title">{done ? '¡Solicitud enviada!' : 'Hacer reserva'}</h2>
            <p>{hotel.name}</p>
          </div>
          <button type="button" className="lg-close" aria-label="Cerrar" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {done ? (
          <div className="lg-done">
            <CheckCircle2 size={48} aria-hidden="true" />
            <p>
              Le pediste a <strong>{hotel.name}</strong> hospedarte del <strong>{dateLabel(done.check_in)}</strong> al <strong>{dateLabel(done.check_out)}</strong> (
              {done.nights === 1 ? '1 noche' : `${done.nights} noches`}). Te avisaremos cuando el hotel confirme; también pueden llamarte al {phoneLabel(done.phone)}.
            </p>
            <div className="lg-dialog-actions">
              <button type="button" className="lg-btn outline" onClick={onClose}>
                Seguir viendo hoteles
              </button>
              <button type="button" className="lg-btn primary" onClick={onDone}>
                Ver mis reservas
              </button>
            </div>
          </div>
        ) : (
          <form className="lg-form" onSubmit={submit} noValidate>
            <div className="lg-grid2">
              <label className="lg-field">
                Llegada
                <input type="date" value={form.check_in} min={today} onChange={(e) => set({ check_in: e.target.value })} required />
              </label>
              <label className="lg-field">
                Salida
                <input type="date" value={form.check_out} min={form.check_in ? addDays(form.check_in, 1) : today} onChange={(e) => set({ check_out: e.target.value })} required />
              </label>
            </div>
            <Counter label="Huéspedes" value={form.guests} min={1} max={50} onChange={(guests) => set({ guests })} />
            <Counter label="Habitaciones" value={form.rooms} min={1} max={20} onChange={(rooms) => set({ rooms })} />
            <label className="lg-field">
              Tu celular
              <input type="tel" inputMode="tel" value={form.phone} placeholder="310 123 4567" onChange={(e) => set({ phone: e.target.value })} />
            </label>
            <label className="lg-field">
              <span>
                Mensaje para el hotel <span className="lg-optional">(opcional)</span>
              </span>
              <textarea rows={3} maxLength={500} value={form.message} placeholder="Ej: Llegamos tarde en la noche, viajamos con un niño…" onChange={(e) => set({ message: e.target.value })} />
            </label>

            {nights > 0 && (
              <div className="lg-summary">
                <span>
                  {nights === 1 ? '1 noche' : `${nights} noches`} · {form.rooms === 1 ? '1 habitación' : `${form.rooms} habitaciones`}
                </span>
                <strong>Desde {formatCop(hotel.price_from_cop * nights * form.rooms)}</strong>
                <small>Precio de referencia. El hotel te confirma el valor final y cómo pagar; NeirAPP no cobra la estadía.</small>
              </div>
            )}
            {error && (
              <p className="lg-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="lg-btn primary wide" disabled={busy}>
              {busy ? <Loader2 size={18} className="lg-spin" aria-hidden="true" /> : <CalendarCheck size={18} aria-hidden="true" />} Enviar solicitud
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

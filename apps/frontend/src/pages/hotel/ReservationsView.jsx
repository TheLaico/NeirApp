import { CalendarDays, CheckCircle2, Loader2, MessageCircle, Phone, Users, XCircle } from 'lucide-react';
import { useState } from 'react';
import { lodgingApi } from '../../features/lodging/api.js';
import { STATUS, dateLabel, isoDay, phoneLabel, telLink } from '../../features/lodging/model.js';

const TABS = [
  { key: 'pending', label: 'Por responder' },
  { key: 'upcoming', label: 'Confirmadas' },
  { key: 'history', label: 'Historial' },
];

const guestWhatsapp = (r, hotel) =>
  `https://wa.me/57${r.phone}?text=${encodeURIComponent(`Hola ${r.customer_name.split(' ')[0]}, te escribimos de ${hotel.name} por tu reserva del ${dateLabel(r.check_in)} en NeirAPP.`)}`;

/** Solicitudes de reserva: el hotel confirma (con una nota opcional) o rechaza; el turista recibe el aviso. */
export default function ReservationsView({ hotel, reservations, onChange, onGo }) {
  const [tab, setTab] = useState('pending');
  const [answering, setAnswering] = useState(null); // { id, accept }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const today = isoDay(new Date());

  if (!hotel) {
    return (
      <div className="spp-view">
        <div className="spp-head">
          <h1>Reservas</h1>
        </div>
        <button type="button" className="spp-banner warn" onClick={() => onGo('hotel')}>
          <span>Primero crea la ficha de tu hotel para recibir reservas.</span>
        </button>
      </div>
    );
  }

  const groups = {
    pending: reservations.filter((r) => r.status === 'pending'),
    upcoming: reservations.filter((r) => r.status === 'confirmed' && r.check_out >= today).sort((a, b) => a.check_in.localeCompare(b.check_in)),
    history: reservations.filter((r) => r.status !== 'pending' && !(r.status === 'confirmed' && r.check_out >= today)),
  };
  const list = groups[tab];

  const answer = async (r) => {
    if (!answering.accept && note.trim().length < 3) return setError('Cuéntale al huésped por qué (por ejemplo, que no hay habitaciones esas fechas).');
    setBusy(true);
    setError('');
    try {
      onChange(await (answering.accept ? lodgingApi.confirm(r.id, note) : lodgingApi.decline(r.id, note)));
      setAnswering(null);
      setNote('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="spp-view">
      <div className="spp-head">
        <h1>Reservas</h1>
        <p>Los turistas piden fechas desde Hospedaje. Confírmalas o recházalas y les avisamos; el pago lo acuerdas directamente con ellos.</p>
      </div>
      <div className="htp-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
            {t.label} {groups[t.key].length > 0 && <span>{groups[t.key].length}</span>}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="sp-empty">{tab === 'pending' ? 'No tienes solicitudes por responder.' : tab === 'upcoming' ? 'No tienes estadías confirmadas próximas.' : 'Aquí verás las reservas pasadas, rechazadas y canceladas.'}</p>
      ) : (
        <ul className="htp-res-list">
          {list.map((r) => {
            const status = STATUS[r.status];
            const open = answering?.id === r.id;
            return (
              <li key={r.id} className="htp-res">
                <div className="htp-res-top">
                  <div>
                    <strong>{r.customer_name}</strong>
                    <span className={`lg-status ${status.tone}`}>{status.label}</span>
                  </div>
                  <span className="htp-res-when">Pedida el {new Date(r.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
                </div>
                <ul className="htp-res-facts">
                  <li>
                    <CalendarDays size={16} aria-hidden="true" /> {dateLabel(r.check_in)} → {dateLabel(r.check_out)} · <strong>{r.nights === 1 ? '1 noche' : `${r.nights} noches`}</strong>
                  </li>
                  <li>
                    <Users size={16} aria-hidden="true" /> {r.guests === 1 ? '1 huésped' : `${r.guests} huéspedes`} · {r.rooms === 1 ? '1 habitación' : `${r.rooms} habitaciones`}
                  </li>
                  <li>
                    <Phone size={16} aria-hidden="true" /> {phoneLabel(r.phone)}
                  </li>
                </ul>
                {r.message && <p className="htp-res-msg">“{r.message}”</p>}
                {r.hotel_note && <p className="htp-res-note">Tu nota: {r.hotel_note}</p>}
                <div className="htp-res-actions">
                  <a className="sp-btn outline small" href={guestWhatsapp(r, hotel)} target="_blank" rel="noreferrer">
                    <MessageCircle size={15} aria-hidden="true" /> WhatsApp
                  </a>
                  <a className="sp-btn outline small" href={telLink(r.phone)}>
                    <Phone size={15} aria-hidden="true" /> Llamar
                  </a>
                  {r.status === 'pending' && !open && (
                    <>
                      <button type="button" className="sp-btn danger small" onClick={() => (setAnswering({ id: r.id, accept: false }), setNote(''), setError(''))}>
                        <XCircle size={15} aria-hidden="true" /> Rechazar
                      </button>
                      <button type="button" className="sp-btn primary small" onClick={() => (setAnswering({ id: r.id, accept: true }), setNote(''), setError(''))}>
                        <CheckCircle2 size={15} aria-hidden="true" /> Confirmar
                      </button>
                    </>
                  )}
                </div>
                {open && (
                  <form
                    className="htp-answer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      answer(r);
                    }}
                  >
                    <label className="sp-field">
                      {answering.accept ? 'Nota para el huésped (opcional)' : 'Motivo (lo verá el huésped)'}
                      <input value={note} maxLength={300} autoFocus placeholder={answering.accept ? 'Ej: Te esperamos, el parqueadero queda a la entrada.' : 'Ej: No tenemos habitaciones esas fechas.'} onChange={(e) => setNote(e.target.value)} />
                    </label>
                    {error && (
                      <p className="sp-error" role="alert">
                        {error}
                      </p>
                    )}
                    <div className="htp-res-actions">
                      <button type="button" className="sp-btn outline small" onClick={() => setAnswering(null)}>
                        Volver
                      </button>
                      <button type="submit" className={`sp-btn small ${answering.accept ? 'primary' : 'danger'}`} disabled={busy}>
                        {busy && <Loader2 size={15} className="sp-spin" aria-hidden="true" />} {answering.accept ? 'Confirmar reserva' : 'Rechazar reserva'}
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { ArrowLeft, BedDouble, CalendarDays, Loader2, MapPin, MessageCircle, Phone, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import { lodgingApi } from '../../features/lodging/api.js';
import { STATUS, dateLabel, telLink, whatsappLink } from '../../features/lodging/model.js';
import { useNavigate } from '../../lib/router.jsx';
import { hotelPath } from './LodgingPage.jsx';
import './lodging.css';

/** Las reservas que pidió el turista y en qué van (esperando, confirmada, no disponible, cancelada). */
export default function MyReservationsPage({ user, onLogout }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setState({ list: await lodgingApi.myReservations(), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (r) => {
    if (!window.confirm(`¿Cancelar tu reserva en ${r.hotel.name}? Le avisaremos al hotel.`)) return;
    setBusy(r.id);
    setError('');
    try {
      const updated = await lodgingApi.cancelReservation(r.id);
      setState((s) => ({ ...s, list: s.list.map((x) => (x.id === r.id ? updated : x)) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageShell user={user} onLogout={onLogout} flush className="lg-view">
      <div className="lg-page lg-narrow">
        <button type="button" className="lg-back" onClick={() => navigate('/hospedaje')}>
          <ArrowLeft size={18} aria-hidden="true" /> Volver a Hospedaje
        </button>
        <header className="lg-head">
          <div>
            <h1>Mis reservas</h1>
            <p>El hotel confirma tu solicitud y te avisamos aquí y en la campana. El pago se acuerda con el hotel.</p>
          </div>
        </header>
        {error && (
          <p className="lg-error" role="alert">
            {error}
          </p>
        )}
        {state.loading ? (
          <p className="lg-empty">Cargando…</p>
        ) : state.error ? (
          <div className="lg-empty">
            <p role="alert">{state.error}</p>
            <button type="button" className="lg-btn outline" onClick={load}>
              Reintentar
            </button>
          </div>
        ) : state.list.length === 0 ? (
          <div className="lg-empty">
            <BedDouble size={40} aria-hidden="true" />
            <p>Todavía no has pedido ninguna reserva.</p>
            <button type="button" className="lg-btn primary" onClick={() => navigate('/hospedaje')}>
              Ver hoteles en Neira
            </button>
          </div>
        ) : (
          <ul className="lg-res-list">
            {state.list.map((r) => {
              const status = STATUS[r.status];
              const open = r.status === 'pending' || r.status === 'confirmed';
              return (
                <li key={r.id} className="lg-res">
                  <button type="button" className="lg-res-photo" onClick={() => navigate(hotelPath(r.hotel_id))} aria-label={`Ver ${r.hotel.name}`}>
                    {r.hotel.photo && <img src={r.hotel.photo} alt="" />}
                  </button>
                  <div className="lg-res-info">
                    <span className={`lg-status ${status.tone}`}>{status.label}</span>
                    <h2>{r.hotel.name}</h2>
                    <p>
                      <CalendarDays size={15} aria-hidden="true" /> {dateLabel(r.check_in)} → {dateLabel(r.check_out)} · {r.nights === 1 ? '1 noche' : `${r.nights} noches`}
                    </p>
                    <p>
                      <Users size={15} aria-hidden="true" /> {r.guests === 1 ? '1 huésped' : `${r.guests} huéspedes`} · {r.rooms === 1 ? '1 habitación' : `${r.rooms} habitaciones`}
                    </p>
                    {r.hotel.address && (
                      <p>
                        <MapPin size={15} aria-hidden="true" /> {r.hotel.address}
                      </p>
                    )}
                    {r.hotel_note && <p className="lg-res-note">“{r.hotel_note}” — {r.hotel.name}</p>}
                  </div>
                  <div className="lg-res-actions">
                    {r.hotel.whatsapp ? (
                      <a className="lg-btn outline small" href={whatsappLink(r.hotel.whatsapp, r.hotel.name)} target="_blank" rel="noreferrer">
                        <MessageCircle size={15} aria-hidden="true" /> WhatsApp
                      </a>
                    ) : (
                      r.hotel.phone && (
                        <a className="lg-btn outline small" href={telLink(r.hotel.phone)}>
                          <Phone size={15} aria-hidden="true" /> Llamar
                        </a>
                      )
                    )}
                    {open && (
                      <button type="button" className="lg-btn danger small" disabled={busy === r.id} onClick={() => cancel(r)}>
                        {busy === r.id && <Loader2 size={15} className="lg-spin" aria-hidden="true" />} Cancelar
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageShell>
  );
}

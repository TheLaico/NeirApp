import { ArrowLeft, CalendarDays, Clock, Loader2, MapPin, MessageCircle, Navigation, Phone, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import { dateLabel, directionsLink } from '../../features/lodging/model.js';
import { venuesApi } from '../../features/venues/api.js';
import { STATUS, telLink, timeLabel, whatsappLink } from '../../features/venues/model.js';
import { useNavigate } from '../../lib/router.jsx';
import '../lodging/lodging.css';
import { venuePath } from './VenuesPage.jsx';

/** Las reservas que pidió el cliente en Reservas y en qué van (esperando, confirmada, no disponible, cancelada). */
export default function MyBookingsPage({ user, onLogout }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setState({ list: await venuesApi.myBookings(), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (r) => {
    if (!window.confirm(`¿Cancelar tu reserva en ${r.venue.name}? Le avisaremos al lugar.`)) return;
    setBusy(r.id);
    setError('');
    try {
      const updated = await venuesApi.cancelBooking(r.id);
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
        <button type="button" className="lg-back" onClick={() => navigate('/reservas')}>
          <ArrowLeft size={18} aria-hidden="true" /> Volver a Reservas
        </button>
        <header className="lg-head">
          <div>
            <h1>Mis reservas</h1>
            <p>El lugar confirma tu solicitud y te avisamos aquí y en la campana.</p>
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
            <CalendarDays size={40} aria-hidden="true" />
            <p>Todavía no has pedido ninguna reserva.</p>
            <button type="button" className="lg-btn primary" onClick={() => navigate('/reservas')}>
              Ver lugares para reservar
            </button>
          </div>
        ) : (
          <ul className="lg-res-list">
            {state.list.map((r) => {
              const status = STATUS[r.status];
              const open = r.status === 'pending' || r.status === 'confirmed';
              return (
                <li key={r.id} className="lg-res">
                  <button type="button" className="lg-res-photo" onClick={() => navigate(venuePath(r.venue_id))} aria-label={`Ver ${r.venue.name}`}>
                    {r.venue.photo && <img src={r.venue.photo} alt="" />}
                  </button>
                  <div className="lg-res-info">
                    <span className={`lg-status ${status.tone}`}>{status.label}</span>
                    <h2>{r.venue.name}</h2>
                    <p>
                      <CalendarDays size={15} aria-hidden="true" /> {dateLabel(r.day, { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                    <p>
                      <Clock size={15} aria-hidden="true" /> {timeLabel(r.at)} · <Users size={15} aria-hidden="true" /> {r.people === 1 ? '1 persona' : `${r.people} personas`}
                    </p>
                    {r.venue.address && (
                      <p>
                        <MapPin size={15} aria-hidden="true" /> {r.venue.address}
                      </p>
                    )}
                    {r.venue_note && <p className="lg-res-note">“{r.venue_note}” — {r.venue.name}</p>}
                  </div>
                  <div className="lg-res-actions">
                    {r.venue.whatsapp ? (
                      <a className="lg-btn outline small" href={whatsappLink(r.venue.whatsapp, r.venue.name)} target="_blank" rel="noreferrer">
                        <MessageCircle size={15} aria-hidden="true" /> WhatsApp
                      </a>
                    ) : (
                      r.venue.phone && (
                        <a className="lg-btn outline small" href={telLink(r.venue.phone)}>
                          <Phone size={15} aria-hidden="true" /> Llamar
                        </a>
                      )
                    )}
                    {r.status === 'confirmed' && (
                      <a className="lg-btn outline small" href={directionsLink(r.venue)} target="_blank" rel="noreferrer">
                        <Navigation size={15} aria-hidden="true" /> Cómo llegar
                      </a>
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

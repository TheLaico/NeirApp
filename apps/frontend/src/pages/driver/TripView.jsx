import { CheckCircle2, Flag, Loader2, MapPin, MessageCircle, Navigation, Play, Users, X } from 'lucide-react';
import { useState } from 'react';
import { ridesApi } from '../../features/rides/api.js';
import { STATUS, people, phoneLabel, timeOf, whatsappLink } from '../../features/rides/model.js';
import { formatCop } from '../../lib/money.js';
import { Avatar, CallButton } from '../transport/parts.jsx';
import RideMap from '../transport/RideMap.jsx';

const STEP = {
  accepted: { label: 'Llegué al punto de recogida', Icon: Flag, run: (id) => ridesApi.arrived(id) },
  arrived: { label: 'Iniciar viaje', Icon: Play, run: (id) => ridesApi.start(id) },
  in_progress: { label: 'Finalizar viaje', Icon: CheckCircle2, run: (id) => ridesApi.complete(id) },
};

/** "Mis viajes": el viaje en curso (cliente en vivo en el mapa, llamar, pasos) y los viajes de hoy. */
export default function TripView({ ride, today, position, gpsError, onPick, onChange, onFinished }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      const updated = await action();
      if (updated.status === 'completed') setDone(updated);
      onChange(updated);
      if (!['accepted', 'arrived', 'in_progress'].includes(updated.status)) onFinished();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const step = ride && STEP[ride.status];
  const customer = ride?.customer_lat ? { lat: ride.customer_lat, lng: ride.customer_lng, label: ride.customer_name.split(' ')[0] } : null;

  return (
    <div className="dr-view">
      <div className="spp-head">
        <h1>Mis viajes</h1>
        <p>Acepta un cliente a la vez. Cuando lo recojas, inicia el viaje; al llegar, finalízalo y cobra {formatCop(2500)} por persona.</p>
      </div>
      {done && (
        <p className="spp-banner ok" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>
            ¡Viaje terminado! Cobra <b>{formatCop(done.fare_cop)}</b> ({people(done.passengers)}).
          </span>
        </p>
      )}
      {error && <p className="spp-banner bad">{error}</p>}

      {ride ? (
        <div className="dr-trip">
          <section className="dr-card">
            <span className={`tr-status ${STATUS[ride.status].tone}`}>{STATUS[ride.status].label}</span>
            <div className="dr-customer">
              <Avatar name={ride.customer_name} size={56} />
              <div>
                <strong>{ride.customer_name}</strong>
                <span>{phoneLabel(ride.customer_phone)}</span>
              </div>
            </div>
            <ul className="dr-trip-facts">
              <li>
                <MapPin size={17} aria-hidden="true" /> <span>Recoger en <strong>{ride.address}</strong>{ride.reference ? ` · ${ride.reference}` : ''}</span>
              </li>
              {ride.destination && (
                <li>
                  <Navigation size={17} aria-hidden="true" /> <span>Hacia <strong>{ride.destination}</strong></span>
                </li>
              )}
              <li>
                <Users size={17} aria-hidden="true" /> <span>{people(ride.passengers)} · cobrar <strong>{formatCop(ride.fare_cop)}</strong></span>
              </li>
            </ul>
            {!customer && ride.status !== 'in_progress' && <p className="sp-muted">El cliente no está compartiendo su ubicación: guíate por el punto de recogida.</p>}
            <div className="dr-trip-actions">
              <CallButton phone={ride.customer_phone} className="sp-btn outline" />
              {ride.customer_phone && (
                <a className="sp-btn outline" href={whatsappLink(ride.customer_phone, `Hola ${ride.customer_name.split(' ')[0]}, soy tu conductor de motocarro de NeirAPP. Voy por ti.`)} target="_blank" rel="noreferrer">
                  <MessageCircle size={16} aria-hidden="true" /> WhatsApp
                </a>
              )}
              <a className="sp-btn outline" href={`https://www.google.com/maps/dir/?api=1&destination=${ride.pickup_lat},${ride.pickup_lng}`} target="_blank" rel="noreferrer">
                <Navigation size={16} aria-hidden="true" /> Cómo llegar
              </a>
            </div>
            {step && (
              <button type="button" className="sp-btn primary dr-step" disabled={busy} onClick={() => run(() => step.run(ride.id))}>
                {busy ? <Loader2 size={18} className="sp-spin" aria-hidden="true" /> : <step.Icon size={18} aria-hidden="true" />} {step.label}
                {ride.status === 'in_progress' && ` (cobrar ${formatCop(ride.fare_cop)})`}
              </button>
            )}
            {ride.status !== 'in_progress' && (
              <button type="button" className="sp-btn danger small dr-cancel" disabled={busy} onClick={() => window.confirm('¿Cancelar este viaje? Le avisaremos al cliente.') && run(() => ridesApi.cancel(ride.id))}>
                <X size={15} aria-hidden="true" /> Cancelar viaje
              </button>
            )}
          </section>
          <section className="dr-card dr-map-card">
            <RideMap pickup={{ lat: ride.pickup_lat, lng: ride.pickup_lng }} customer={customer} driver={position ? { ...position, label: 'Tú' } : null} onPick={!position || gpsError ? onPick : undefined} className="dr-map tall" />
            {(!position || gpsError) && (
              <p className="dr-gps">
                <MapPin size={15} aria-hidden="true" /> {gpsError || 'No sabemos dónde estás.'} Toca el mapa para marcar tu ubicación.
              </p>
            )}
          </section>
        </div>
      ) : (
        <p className="sp-empty">No tienes un viaje en curso. Acepta una solicitud desde Inicio.</p>
      )}

      <section className="dr-card">
        <h2>Viajes de hoy</h2>
        {today?.recent?.length ? (
          <ul className="dr-history">
            {today.recent.map((r) => (
              <li key={r.id}>
                <Avatar name={r.customer_name} size={36} />
                <span>
                  <strong>{r.address}</strong>
                  <small>
                    {people(r.passengers)}
                    {r.destination ? ` · hacia ${r.destination}` : ''}
                  </small>
                </span>
                <span className="dr-history-fare">
                  <strong>{formatCop(r.fare_cop)}</strong>
                  <small>{timeOf(r.completed_at)}</small>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sp-muted">Todavía no has terminado viajes hoy.</p>
        )}
      </section>
    </div>
  );
}

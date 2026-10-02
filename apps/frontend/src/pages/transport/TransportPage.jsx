import { CheckCircle2, Clock, Crosshair, Eye, Loader2, MapPin, MessageSquareText, Navigation, Share2, Star, Users, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import motocarroFondo from '../../assets/Transporte/motocarro-fondo.webp';
import motocarro from '../../assets/Transporte/motocarro.webp';
import fondoBuscador from '../../assets/fondo-buscador.png';
import PageShell from '../../components/layout/PageShell.jsx';
import { ridesApi } from '../../features/rides/api.js';
import { ACTIVE, FARE_PER_PERSON, MAX_PASSENGERS, STATUS, dayTime, inNeira, people, useGeolocation, usePolling } from '../../features/rides/model.js';
import { formatCop } from '../../lib/money.js';
import { useNavigate } from '../../lib/router.jsx';
import { usePersistentState } from '../../lib/usePersistentState.js';
import { Stars, StarsInput } from '../lodging/Stars.jsx';
import { CallButton, DriverInfo, PeopleCounter } from './parts.jsx';
import RideMap from './RideMap.jsx';
import './transport.css';

export const trackPath = (id) => `/transporte/viaje?id=${id}`;
// El mismo valor que lee `RideAlert` para avisar en cualquier pantalla cuando el motocarro acepte.
export const WATCH_KEY = 'neirapp.transporte.viaje';

/**
 * Transporte: pedir un motocarro en Neira. El cliente dice cuántas personas van (máximo 3) y dónde lo recogen (su
 * ubicación actual, que puede ajustar tocando el mapa). La solicitud les aparece a los conductores; el primero que
 * acepta va por él y desde ahí se ve en vivo en el mapa. $ 2.500 por persona, se le paga al conductor.
 */
export default function TransportPage({ user, onLogout }) {
  const navigate = useNavigate();
  const [ride, setRide] = useState(undefined); // undefined: cargando; null: ninguno
  const [live, setLive] = useState([]);
  const [recent, setRecent] = useState([]);
  const [dismissed, setDismissed] = usePersistentState('neirapp.transporte.ocultos', []);
  const [, setWatch] = usePersistentState(WATCH_KEY, '');

  const loadRide = useCallback(async () => {
    try {
      const current = await ridesApi.current();
      setRide(current);
      setWatch(current && ACTIVE.includes(current.status) ? current.id : '');
    } catch {
      setRide((r) => (r === undefined ? null : r));
    }
  }, [setWatch]);
  const loadLive = useCallback(() => ridesApi.live().then(setLive).catch(() => {}), []);
  const loadRecent = useCallback(() => ridesApi.mine().then((list) => setRecent(list.filter((r) => r.status === 'completed').slice(0, 3))).catch(() => {}), []);

  usePolling(loadRide, 4000);
  usePolling(loadLive, 8000);
  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const active = ride && ACTIVE.includes(ride.status);
  const shown = ride && !dismissed.includes(ride.id) ? ride : null;
  const pickupOfRide = shown && (active || shown.status === 'completed') ? { lat: shown.pickup_lat, lng: shown.pickup_lng } : null;
  const [pickup, setPickup] = useState(null);
  const mapPickup = pickupOfRide ?? pickup;

  const driverOnMap = shown?.driver && ['accepted', 'arrived', 'in_progress'].includes(shown.status) ? { lat: shown.driver.lat, lng: shown.driver.lng, label: shown.driver.plate_label } : null;
  const me = shown?.customer_lat ? { lat: shown.customer_lat, lng: shown.customer_lng, label: 'Tú' } : null;

  let panel;
  if (ride === undefined) panel = <p className="tr-empty">Cargando…</p>;
  else if (!shown) panel = <RequestForm user={user} pickup={pickup} setPickup={setPickup} onRequested={(r) => (setRide(r), setWatch(r.id))} />;
  else if (shown.status === 'requested') panel = <Waiting ride={shown} onCancel={async () => setRide(await ridesApi.cancel(shown.id))} />;
  else if (['accepted', 'arrived', 'in_progress'].includes(shown.status)) panel = <Assigned ride={shown} onTrack={() => navigate(trackPath(shown.id))} onCancel={async () => setRide(await ridesApi.cancel(shown.id))} />;
  else if (shown.status === 'completed') panel = <RateRide ride={shown} onDone={(r) => (setRide(r.rating ? null : r), loadRecent())} onSkip={() => setDismissed((d) => [...d, shown.id])} />;
  else panel = <Expired ride={shown} onRetry={() => setDismissed((d) => [...d, shown.id])} />;

  return (
    <PageShell user={user} onLogout={onLogout} flush heroImage={fondoBuscador} centerLogo className="tr-view">
      <div className="tr-page">
        <div className="tr-layout">
          <section className="tr-panel" aria-live="polite">
            {panel}
          </section>
          <RideMap
            live={live}
            pickup={mapPickup}
            customer={me}
            driver={driverOnMap}
            onPick={!active && !shown ? (lat, lng) => inNeira(lat, lng) && setPickup({ lat, lng, manual: true }) : undefined}
            className="tr-main-map"
          />
        </div>

        {recent.length > 0 && (
          <section className="tr-recent" aria-labelledby="tr-recent-title">
            <div className="tr-recent-head">
              <h2 id="tr-recent-title">Viajes recientes</h2>
            </div>
            <ul>
              {recent.map((r) => (
                <li key={r.id} className="tr-trip">
                  <img src={r.driver?.vehicle_photo_url || motocarro} alt="" />
                  <div>
                    <strong>Motocarro {r.driver?.plate_label ?? ''}</strong>
                    <small>
                      {r.address}
                      {r.destination ? ` → ${r.destination}` : ''}
                    </small>
                    <span className="tr-trip-fare">{formatCop(r.fare_cop)}</span>
                    {r.rating > 0 && <Stars value={r.rating} size={13} />}
                  </div>
                  <button type="button" className="tr-btn outline small" onClick={() => navigate(trackPath(r.id))}>
                    Ver detalle
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageShell>
  );
}

function RequestForm({ user, pickup, setPickup, onRequested }) {
  const gps = useGeolocation(!pickup?.manual);
  const [form, setForm] = useState({ passengers: 1, address: '', reference: '', destination: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Mientras no la ajuste a mano, la recogida sigue la ubicación del teléfono.
  useEffect(() => {
    if (gps.position && !pickup?.manual) setPickup({ ...gps.position, manual: false });
  }, [gps.position]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!pickup) return setError('Marca en el mapa dónde te recogen (toca el punto exacto).');
    if (form.address.trim().length < 3) return setError('Escribe la dirección o un punto de referencia para que el conductor te encuentre.');
    setBusy(true);
    try {
      onRequested(await ridesApi.request({ ...form, lat: pickup.lat, lng: pickup.lng }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="tr-card tr-request" onSubmit={submit} noValidate>
      <h1>Solicita un motocarro</h1>
      <p className="tr-sub">Rápido, seguro y dentro de Neira</p>

      <div className="tr-field">
        <span>¿Cuántas personas van?</span>
        <PeopleCounter value={form.passengers} max={MAX_PASSENGERS} onChange={(passengers) => set({ passengers })} />
      </div>

      <label className="tr-field">
        <span>Ubicación de recogida</span>
        <span className="tr-input">
          <MapPin size={17} aria-hidden="true" />
          <input value={form.address} maxLength={120} placeholder={`Ej: Calle 8 #4-21, Neira`} onChange={(e) => set({ address: e.target.value })} />
        </span>
      </label>
      <p className={`tr-gps${pickup ? ' ok' : ''}`}>
        <Crosshair size={15} aria-hidden="true" />
        {pickup
          ? pickup.manual
            ? 'Punto ajustado en el mapa. Toca el mapa para moverlo.'
            : 'Usamos tu ubicación actual. Si no coincide, toca el mapa para ajustarla.'
          : gps.error
            ? `${gps.error} Toca el mapa donde te recogen.`
            : 'Buscando tu ubicación… o toca el mapa donde te recogen.'}
      </p>
      {pickup?.manual && (
        <button type="button" className="tr-link" onClick={() => setPickup(null)}>
          Volver a usar mi ubicación
        </button>
      )}

      <label className="tr-field">
        <span>
          Referencia <small>(opcional)</small>
        </span>
        <input className="tr-plain" value={form.reference} maxLength={120} placeholder="Ej: Frente a la panadería, casa azul" onChange={(e) => set({ reference: e.target.value })} />
      </label>
      <label className="tr-field">
        <span>
          ¿A dónde vas? <small>(opcional)</small>
        </span>
        <input className="tr-plain" value={form.destination} maxLength={120} placeholder="Ej: Terminal, Hospital, Parque" onChange={(e) => set({ destination: e.target.value })} />
      </label>

      <div className="tr-fare">
        <span>
          {people(form.passengers)} × {formatCop(FARE_PER_PERSON)}
        </span>
        <strong>{formatCop(FARE_PER_PERSON * form.passengers)}</strong>
        <small>Le pagas al conductor al llegar.</small>
      </div>
      {error && (
        <p className="tr-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="tr-btn primary wide" disabled={busy}>
        {busy && <Loader2 size={18} className="tr-spin" aria-hidden="true" />} Solicitar motocarro
      </button>
      {!user.phone && <small className="tr-muted">Agrega tu celular en tu perfil para que el conductor pueda llamarte.</small>}
    </form>
  );
}

function Waiting({ ride, onCancel }) {
  const [busy, setBusy] = useState(false);
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(ride.requested_at)) / 60000));
  return (
    <div className="tr-card tr-state">
      <div className="tr-hero">
        <img src={motocarroFondo} alt="" />
        <span className="tr-check">
          <CheckCircle2 size={34} aria-hidden="true" />
        </span>
      </div>
      <h2>¡Solicitud enviada!</h2>
      <p className="tr-sub">Tu solicitud ya fue compartida con los conductores cercanos. Te avisamos apenas uno la acepte.</p>
      <p className="tr-searching">
        <Loader2 size={16} className="tr-spin" aria-hidden="true" /> Buscando motocarro{minutes ? ` · hace ${minutes} min` : '…'}
      </p>
      <div className="tr-details">
        <h3>Detalles de la solicitud</h3>
        <p>
          <Users size={16} aria-hidden="true" /> {people(ride.passengers)} · {formatCop(ride.fare_cop)}
        </p>
        <p>
          <MapPin size={16} aria-hidden="true" /> {ride.address}
          {ride.reference ? ` · ${ride.reference}` : ''}
        </p>
        {ride.destination && (
          <p>
            <Navigation size={16} aria-hidden="true" /> Hacia {ride.destination}
          </p>
        )}
      </div>
      <button type="button" className="tr-btn outline wide" disabled={busy} onClick={async () => window.confirm('¿Cancelar la solicitud?') && (setBusy(true), await onCancel().catch(() => {}), setBusy(false))}>
        <X size={17} aria-hidden="true" /> Cancelar solicitud
      </button>
    </div>
  );
}

const HEADINGS = {
  accepted: ['¡Tu motocarro ha sido asignado!', 'El conductor ya aceptó tu solicitud y va en camino.'],
  arrived: ['¡Tu motocarro llegó!', 'Te está esperando en el punto de recogida.'],
  in_progress: ['En camino', 'Disfruta tu viaje. Le pagas al conductor al llegar.'],
};

function Assigned({ ride, onTrack, onCancel }) {
  const [title, text] = HEADINGS[ride.status];
  const d = ride.driver;
  return (
    <div className="tr-card tr-state">
      <span className="tr-check small">
        <CheckCircle2 size={28} aria-hidden="true" />
      </span>
      <h2>{title}</h2>
      <p className="tr-sub">{text}</p>
      {d && <DriverInfo driver={d} />}
      <ul className="tr-facts">
        <li>
          <span>Placa</span>
          <strong>{d?.plate_label}</strong>
        </li>
        <li>
          <span>{ride.status === 'accepted' ? 'Llega en' : 'Estado'}</span>
          <strong>{ride.status === 'accepted' ? (ride.eta_minutes ? `${ride.eta_minutes} min` : '—') : STATUS[ride.status].label}</strong>
        </li>
        <li>
          <span>Total</span>
          <strong>{formatCop(ride.fare_cop)}</strong>
        </li>
      </ul>
      <button type="button" className="tr-btn primary wide" onClick={onTrack}>
        <Eye size={18} aria-hidden="true" /> Mirar motocarro
      </button>
      <CallButton phone={d?.phone} className="tr-btn outline wide" />
      <ShareMyLocation ride={ride} />
      {ride.status !== 'in_progress' && (
        <button type="button" className="tr-link danger" onClick={() => window.confirm('¿Cancelar el viaje? Le avisaremos al conductor.') && onCancel().catch(() => {})}>
          Cancelar viaje
        </button>
      )}
    </div>
  );
}

/** Mientras el viaje está abierto, manda la ubicación del cliente cada 10 s para que el conductor lo vea. */
export function ShareMyLocation({ ride }) {
  const [on, setOn] = usePersistentState('neirapp.transporte.compartir', true);
  const open = ['requested', 'accepted', 'arrived'].includes(ride.status);
  const gps = useGeolocation(on && open);
  const [sentAt, setSentAt] = useState(0);
  useEffect(() => {
    if (!on || !open || !gps.position || Date.now() - sentAt < 10000) return;
    setSentAt(Date.now());
    ridesApi.shareLocation(ride.id, gps.position.lat, gps.position.lng).catch(() => {});
  }, [gps.position, on, open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  return (
    <label className="tr-share">
      <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
      <Share2 size={16} aria-hidden="true" />
      <span>
        Compartir mi ubicación con el conductor
        {on && gps.error && <small>{gps.error}</small>}
      </span>
    </label>
  );
}

function RateRide({ ride, onDone, onSkip }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!stars) return setError('Elige de 1 a 5 estrellas.');
    setBusy(true);
    try {
      onDone(await ridesApi.rate(ride.id, stars, comment.trim()));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <div className="tr-card tr-state">
      <span className="tr-check small">
        <Star size={26} aria-hidden="true" />
      </span>
      <h2>¡Llegaste!</h2>
      <p className="tr-sub">¿Cómo te fue con {ride.driver?.name ?? 'tu conductor'}?</p>
      {ride.driver && <DriverInfo driver={ride.driver} compact />}
      <StarsInput value={stars} onChange={(n) => (setStars(n), setError(''))} size={34} />
      <label className="tr-field">
        <span>
          <MessageSquareText size={15} aria-hidden="true" /> Comentario <small>(opcional)</small>
        </span>
        <textarea rows={2} maxLength={300} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ej: Muy amable y puntual" />
      </label>
      {error && <p className="tr-error">{error}</p>}
      <button type="button" className="tr-btn primary wide" disabled={busy} onClick={submit}>
        Calificar
      </button>
      <button type="button" className="tr-link" onClick={onSkip}>
        Ahora no
      </button>
    </div>
  );
}

function Expired({ ride, onRetry }) {
  return (
    <div className="tr-card tr-state">
      <span className="tr-check small warn">
        <Clock size={26} aria-hidden="true" />
      </span>
      <h2>Nadie aceptó tu solicitud</h2>
      <p className="tr-sub">
        Pediste un motocarro el {dayTime(ride.requested_at)} y ningún conductor estaba disponible. Vuelve a intentarlo en unos minutos.
      </p>
      <button type="button" className="tr-btn primary wide" onClick={onRetry}>
        Volver a pedir
      </button>
    </div>
  );
}


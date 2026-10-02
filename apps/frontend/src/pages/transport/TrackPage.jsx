import { ArrowLeft, CalendarClock, Clock, MapPin, Navigation, Users } from 'lucide-react';
import { useCallback, useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import { ridesApi } from '../../features/rides/api.js';
import { ACTIVE, STATUS, dayTime, people, timeOf, usePolling } from '../../features/rides/model.js';
import { formatCop } from '../../lib/money.js';
import { useNavigate } from '../../lib/router.jsx';
import { Stars, StarsInput } from '../lodging/Stars.jsx';
import { CallButton, DriverInfo } from './parts.jsx';
import RideMap from './RideMap.jsx';
import { ShareMyLocation } from './TransportPage.jsx';
import './transport.css';

const TITLES = {
  requested: ['Buscando motocarro', 'Te avisamos apenas un conductor acepte tu solicitud.'],
  accepted: ['Tu motocarro está en camino', 'Míralo acercarse en el mapa.'],
  arrived: ['¡Tu motocarro llegó!', 'Te espera en el punto de recogida.'],
  in_progress: ['En camino', 'Disfruta el viaje.'],
  completed: ['Viaje terminado', 'Gracias por moverte con NeirAPP.'],
  cancelled: ['Viaje cancelado', ''],
  expired: ['Nadie aceptó la solicitud', 'Puedes volver a pedir un motocarro.'],
};

/**
 * "Mirar motocarro": el motocarro en tiempo real sobre el mapa de Neira, con el conductor, la placa, el tiempo
 * estimado y el botón para llamar. Llega aquí desde el aviso "¡Tu motocarro ha sido asignado!". /transporte/viaje?id=
 */
export default function TrackPage({ user, onLogout }) {
  const navigate = useNavigate();
  const [id] = useState(() => new URLSearchParams(window.location.search).get('id'));
  const [state, setState] = useState({ ride: null, error: '' });

  const load = useCallback(async () => {
    try {
      setState({ ride: await ridesApi.get(id), error: '' });
    } catch (err) {
      setState((s) => ({ ...s, error: err.status === 404 || err.status === 403 || err.status === 422 ? 'Este viaje no existe o no es tuyo.' : err.message }));
    }
  }, [id]);
  const ride = state.ride;
  usePolling(load, 4000, !ride || ACTIVE.includes(ride.status));

  const d = ride?.driver;
  const [title, text] = ride ? TITLES[ride.status] : ['', ''];
  const live = ride && ACTIVE.includes(ride.status);

  return (
    <PageShell user={user} onLogout={onLogout} flush className="tr-view">
      <div className="tr-page">
        <button type="button" className="tr-back" onClick={() => navigate('/transporte')}>
          <ArrowLeft size={18} aria-hidden="true" /> Volver a Transporte
        </button>
        {state.error && !ride ? (
          <p className="tr-empty" role="alert">
            {state.error}
          </p>
        ) : !ride ? (
          <p className="tr-empty">Cargando…</p>
        ) : (
          <div className="tr-layout track">
            <section className="tr-panel">
              <div className="tr-card tr-state">
                <span className={`tr-status ${STATUS[ride.status].tone}`}>{STATUS[ride.status].label}</span>
                <h1>{title}</h1>
                {text && <p className="tr-sub">{text}</p>}
                {d && <DriverInfo driver={d} />}
                {d && (
                  <ul className="tr-facts">
                    <li>
                      <span>Placa</span>
                      <strong>{d.plate_label}</strong>
                    </li>
                    <li>
                      <span>Motocarro</span>
                      <strong>{[d.vehicle_model, d.model_year || '', d.color].filter(Boolean).join(' · ') || 'Motocarro'}</strong>
                    </li>
                    {ride.status === 'accepted' && (
                      <li>
                        <span>Llegada estimada</span>
                        <strong>{ride.eta_minutes ? `${ride.eta_minutes} min` : '—'}</strong>
                      </li>
                    )}
                  </ul>
                )}
                {live && d && <CallButton phone={d.phone} className="tr-btn primary wide" />}
                {live && <ShareMyLocation ride={ride} />}
                <div className="tr-details">
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
                  <p>
                    <CalendarClock size={16} aria-hidden="true" /> Pedido el {dayTime(ride.requested_at)}
                    {ride.completed_at && ` · terminó a las ${timeOf(ride.completed_at)}`}
                  </p>
                </div>
                {ride.status === 'completed' && (ride.rating ? <p className="tr-rated"><Stars value={ride.rating} size={16} /> Tu calificación{ride.rating_comment ? `: “${ride.rating_comment}”` : ''}</p> : <Rate ride={ride} onRated={(r) => setState({ ride: r, error: '' })} />)}
                {!live && (
                  <button type="button" className="tr-btn outline wide" onClick={() => navigate('/transporte')}>
                    <Clock size={17} aria-hidden="true" /> Pedir otro motocarro
                  </button>
                )}
              </div>
            </section>
            <RideMap
              pickup={{ lat: ride.pickup_lat, lng: ride.pickup_lng }}
              customer={ride.customer_lat ? { lat: ride.customer_lat, lng: ride.customer_lng, label: 'Tú' } : null}
              driver={d && live && d.lat ? { lat: d.lat, lng: d.lng, label: d.plate_label } : null}
              className="tr-main-map tall"
            />
          </div>
        )}
      </div>
    </PageShell>
  );
}

function Rate({ ride, onRated }) {
  const [stars, setStars] = useState(0);
  const [error, setError] = useState('');
  return (
    <div className="tr-rate-inline">
      <strong>Califica a tu conductor</strong>
      <StarsInput value={stars} onChange={setStars} size={30} />
      {error && <p className="tr-error">{error}</p>}
      <button
        type="button"
        className="tr-btn primary"
        disabled={!stars}
        onClick={async () => {
          try {
            onRated(await ridesApi.rate(ride.id, stars, ''));
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        Enviar calificación
      </button>
    </div>
  );
}

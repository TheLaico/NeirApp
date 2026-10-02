import { ArrowRight, Bike, CircleDollarSign, Loader2, MapPin, Navigation, Power, Users } from 'lucide-react';
import { useState } from 'react';
import motocarro from '../../assets/Transporte/motocarro.webp';
import { ridesApi } from '../../features/rides/api.js';
import { people } from '../../features/rides/model.js';
import { formatCop } from '../../lib/money.js';
import { Stars } from '../lodging/Stars.jsx';
import { Avatar } from '../transport/parts.jsx';
import RideMap from '../transport/RideMap.jsx';

/**
 * Panel principal del conductor: ingresos de hoy, disponible sí/no, su motocarro, su perfil, las solicitudes cercanas
 * y el mapa con esas solicitudes y su ubicación.
 */
export default function HomeView({ driver, ride, requests, today, position, gpsError, onPick, onDriver, onAccepted, onGo, reload }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const toggle = async () => {
    setBusy('online');
    setError('');
    try {
      onDriver(await ridesApi.setOnline(!driver.is_online));
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const accept = async (id) => {
    setBusy(id);
    setError('');
    try {
      onAccepted(await ridesApi.accept(id));
    } catch (err) {
      setError(err.message);
      reload();
    } finally {
      setBusy(null);
    }
  };

  const requestMarkers = requests.map(({ ride: r }) => ({ id: r.id, lat: r.pickup_lat, lng: r.pickup_lng, label: `${r.address} · ${people(r.passengers)}`, active: r.id === selected }));

  return (
    <div className="dr-view">
      <header className="dr-head">
        <span className="dr-head-ico">
          <Bike size={26} aria-hidden="true" />
        </span>
        <div>
          <h1>Panel de conductor</h1>
          <p>Gestiona tus viajes y aumenta tus ingresos</p>
        </div>
        <button type="button" className="dr-income" onClick={() => onGo('earnings')}>
          <span>Ingresos de hoy</span>
          <strong>{formatCop(today?.total_cop ?? 0)}</strong>
          <small>{today?.rides === 1 ? '1 viaje completado' : `${today?.rides ?? 0} viajes completados`}</small>
          <CircleDollarSign size={34} aria-hidden="true" className="dr-income-ico" />
        </button>
      </header>

      <div className={`dr-online${driver.is_online ? ' on' : ''}`}>
        <Power size={22} aria-hidden="true" />
        <div>
          <strong>{driver.is_online ? 'Estás disponible' : 'No estás disponible'}</strong>
          <span>{driver.is_online ? 'Recibes solicitudes de clientes cercanos y apareces en el mapa.' : 'Actívate para ver y aceptar solicitudes.'}</span>
        </div>
        <button type="button" className={`dr-switch${driver.is_online ? ' on' : ''}`} role="switch" aria-checked={driver.is_online} aria-label="Disponible" disabled={busy === 'online'} onClick={toggle}>
          <span />
        </button>
      </div>
      {error && (
        <p className="spp-banner bad" role="alert">
          {error}
        </p>
      )}

      {ride && (
        <button type="button" className="spp-banner wait dr-current" onClick={() => onGo('trips')}>
          <Navigation size={18} aria-hidden="true" />
          <span>
            Tienes un viaje en curso con {ride.customer_name.split(' ')[0]}: {ride.address}
          </span>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      )}

      <div className="dr-cards">
        <section className="dr-card">
          <h2>Tu motocarro</h2>
          <div className="dr-vehicle">
            <img src={driver.vehicle_photo_url || motocarro} alt="Tu motocarro" />
            <ul>
              <li>
                Placa: <strong>{driver.plate_label}</strong>
              </li>
              {(driver.vehicle_model || driver.model_year > 0) && (
                <li>
                  Modelo: <strong>{[driver.vehicle_model, driver.model_year || ''].filter(Boolean).join(' ')}</strong>
                </li>
              )}
              <li>
                Capacidad: <strong>{people(driver.capacity)}</strong>
              </li>
            </ul>
          </div>
          <button type="button" className="sp-btn outline small" onClick={() => onGo('profile')}>
            Ver perfil del motocarro
          </button>
        </section>
        <section className="dr-card">
          <h2>Configuración de tu perfil</h2>
          <div className="dr-me">
            <Avatar name={driver.name} photo={driver.photo_url} size={64} />
            <div>
              <strong>{driver.name}</strong>
              <span className="dr-verified">Conductor verificado</span>
              <span className="dr-rating">{driver.rating_count ? <><Stars value={driver.rating} size={14} /> {driver.rating.toLocaleString('es-CO', { minimumFractionDigits: 1 })} ({driver.rating_count} calificaciones)</> : 'Aún sin calificaciones'}</span>
            </div>
          </div>
          <button type="button" className="sp-btn outline small" onClick={() => onGo('profile')}>
            Editar perfil
          </button>
        </section>
      </div>

      <div className="dr-requests-grid">
        <section className="dr-card">
          <div className="dr-card-head">
            <h2>Solicitudes cercanas</h2>
            {driver.is_online && requests.length > 0 && <span className="dr-count">{requests.length}</span>}
          </div>
          {!driver.is_online ? (
            <p className="sp-muted">Activa "Disponible" para ver las solicitudes de los clientes.</p>
          ) : requests.length === 0 ? (
            <p className="sp-muted">No hay solicitudes en este momento. Te las mostramos apenas un cliente pida un motocarro.</p>
          ) : (
            <ul className="dr-requests">
              {requests.map(({ ride: r, eta_minutes: eta, distance_km: km }) => (
                <li key={r.id} className={r.id === selected ? 'on' : ''}>
                  <button type="button" className="dr-req-info" onClick={() => setSelected(r.id)}>
                    <MapPin size={18} aria-hidden="true" />
                    <span>
                      <strong>{r.address}</strong>
                      <small>
                        <Users size={13} aria-hidden="true" /> {people(r.passengers)} · {formatCop(r.fare_cop)}
                        {r.destination ? ` · hacia ${r.destination}` : ''}
                      </small>
                    </span>
                    <span className="dr-req-eta">{eta ? `~ ${eta} min` : km !== null ? `${km} km` : ''}</span>
                  </button>
                  <button type="button" className="sp-btn primary small" disabled={Boolean(ride) || busy === r.id || r.passengers > driver.capacity} onClick={() => accept(r.id)}>
                    {busy === r.id ? <Loader2 size={15} className="sp-spin" aria-hidden="true" /> : null} Aceptar
                  </button>
                </li>
              ))}
            </ul>
          )}
          {ride && driver.is_online && requests.length > 0 && <p className="sp-muted">Termina tu viaje actual para aceptar otro.</p>}
        </section>
        <section className="dr-card dr-map-card">
          <RideMap
            requests={driver.is_online ? requestMarkers : []}
            customer={null}
            driver={position ? { ...position, label: 'Tú' } : null}
            onSelectRequest={setSelected}
            onPick={!position || gpsError ? onPick : undefined}
            focus={requests.find(({ ride: r }) => r.id === selected) ? { lat: requests.find(({ ride: r }) => r.id === selected).ride.pickup_lat, lng: requests.find(({ ride: r }) => r.id === selected).ride.pickup_lng } : null}
            legend={false}
            className="dr-map"
          />
          {(!position || gpsError) && (
            <p className="dr-gps">
              <MapPin size={15} aria-hidden="true" /> {gpsError || 'No sabemos dónde estás.'} Toca el mapa para marcar tu ubicación.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

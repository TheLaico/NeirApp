import { Bike, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import slogan from '../../assets/slogan.png';
import PanelDesktop from '../../components/panel/PanelDesktop.jsx';
import PanelMobile from '../../components/panel/PanelMobile.jsx';
import { canAccessAdmin } from '../../config/roles.js';
import { useNotifications } from '../../features/notifications/NotificationsContext.jsx';
import { ridesApi } from '../../features/rides/api.js';
import { useGeolocation, usePolling } from '../../features/rides/model.js';
import { useNavigate } from '../../lib/router.jsx';
import { useMediaQuery } from '../../lib/useMediaQuery.js';
import NotificationsView from '../professional/NotificationsView.jsx';
import '../professional/professional-panel.css';
import '../suppliers/suppliers.css';
import '../supplier/supplier-panel.css';
import '../hotel/hotel-panel.css';
import '../transport/transport.css';
import EarningsView from './EarningsView.jsx';
import HomeView from './HomeView.jsx';
import ProfileView from './ProfileView.jsx';
import TripView from './TripView.jsx';
import './driver.css';

const DESKTOP = '(min-width: 1100px)';
const NAV = [
  { key: 'home', label: 'Inicio', icon: 'home' },
  { key: 'trips', label: 'Mis viajes', icon: 'route' },
  { key: 'earnings', label: 'Ganancias', icon: 'wallet' },
  { key: 'profile', label: 'Mi perfil', icon: 'user' },
  { key: 'notifications', label: 'Notificaciones', icon: 'bell' },
];
const TABS = NAV.slice(0, 4);
const SEND_EVERY_MS = 8000;

/**
 * Panel del conductor de motocarro: su perfil y el del motocarro, si está disponible, las solicitudes cercanas en el
 * mapa (acepta una a la vez), el viaje en curso con el cliente en vivo, y sus ingresos. Mientras está disponible o
 * lleva un viaje, la app manda su ubicación cada pocos segundos (o la que marque en el mapa si no hay GPS).
 */
export default function DriverPanelPage({ user, onLogout }) {
  const navigate = useNavigate();
  const desktop = useMediaQuery(DESKTOP);
  const allowed = user.roles?.includes('driver') || canAccessAdmin(user);
  const [view, setView] = useState(() => {
    const section = new URLSearchParams(window.location.search).get('seccion');
    return NAV.some((n) => n.key === section) ? section : 'home';
  });
  const { serverUnread: unread, reload: reloadNotices } = useNotifications();
  const [state, setState] = useState({ driver: undefined, ride: null, requests: [], today: null, error: '' });

  const loadDriver = useCallback(async () => {
    try {
      const driver = await ridesApi.me().catch((err) => {
        if (err.status === 404) return null;
        throw err;
      });
      setState((s) => ({ ...s, driver, error: '' }));
    } catch (err) {
      setState((s) => ({ ...s, driver: s.driver ?? null, error: err.message }));
    }
  }, []);
  useEffect(() => {
    if (allowed) loadDriver();
  }, [allowed, loadDriver]);

  const { driver, ride } = state;
  const working = Boolean(driver && (driver.is_online || ride));

  // Viaje en curso y solicitudes cercanas: se consultan seguido mientras trabaja.
  const loadLive = useCallback(async () => {
    try {
      const [current, requests] = await Promise.all([ridesApi.driverCurrent(), driver?.is_online ? ridesApi.requests() : Promise.resolve([])]);
      setState((s) => ({ ...s, ride: current, requests }));
    } catch {
      /* se reintenta en la próxima vuelta */
    }
  }, [driver?.is_online]);
  usePolling(loadLive, 4000, Boolean(driver));
  const loadToday = useCallback(() => ridesApi.earnings('today').then((today) => setState((s) => ({ ...s, today }))).catch(() => {}), []);
  usePolling(loadToday, 30000, Boolean(driver));

  // Ubicación: GPS si lo hay; si no, la que marque en el mapa.
  const gps = useGeolocation(working);
  const [manual, setManual] = useState(null);
  const position = gps.position ?? manual ?? (driver?.lat ? { lat: driver.lat, lng: driver.lng } : null);
  const lastSent = useRef(0);
  useEffect(() => {
    const p = gps.position ?? manual;
    if (!working || !p || Date.now() - lastSent.current < SEND_EVERY_MS) return;
    lastSent.current = Date.now();
    ridesApi.locate(p.lat, p.lng).catch(() => {});
  }, [gps.position, manual, working]);
  // Aunque el GPS no cambie, se reenvía cada tanto para seguir "en servicio" en el mapa de los clientes.
  usePolling(
    () => {
      const p = gps.position ?? manual;
      if (p) ridesApi.locate(p.lat, p.lng).catch(() => {});
    },
    45000,
    working,
  );
  const pickMyLocation = (lat, lng) => {
    setManual({ lat, lng });
    lastSent.current = 0;
  };

  const setDriver = (d) => setState((s) => ({ ...s, driver: d }));
  const setRide = (r) => setState((s) => ({ ...s, ride: r && ['accepted', 'arrived', 'in_progress'].includes(r.status) ? r : null }));
  const afterTrip = () => {
    loadToday();
    loadLive();
  };

  let content;
  if (!allowed) {
    content = (
      <div className="cr-state">
        <ShieldCheck size={44} aria-hidden="true" />
        <h1>No tienes acceso de conductor</h1>
        <p>Pídele a un administrador que autorice tu correo en Roles (rol Conductor de motocarro).</p>
        <button type="button" className="sp-btn outline" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
      </div>
    );
  } else if (driver === undefined) {
    content = <p className="sp-empty">Cargando…</p>;
  } else if (view === 'profile' || !driver) {
    content = (
      <ProfileView
        user={user}
        driver={driver}
        onSaved={(d) => {
          // Al crearlo por primera vez se va al panel principal; si solo lo edita, se queda aquí.
          if (!driver) setView('home');
          setDriver(d);
        }}
      />
    );
  } else if (view === 'trips') {
    content = <TripView ride={ride} today={state.today} position={position} gpsError={gps.error} onPick={pickMyLocation} onChange={setRide} onFinished={afterTrip} />;
  } else if (view === 'earnings') {
    content = <EarningsView />;
  } else if (view === 'notifications') {
    content = (
      <NotificationsView
        onGo={setView}
        onNavigate={navigate}
        panelPath="/conductor"
        about="Aquí te avisamos si un cliente cancela su viaje."
        empty="Todavía no tienes notificaciones."
      />
    );
  } else {
    content = (
      <HomeView
        driver={driver}
        ride={ride}
        requests={state.requests}
        today={state.today}
        position={position}
        gpsError={gps.error}
        onPick={pickMyLocation}
        onDriver={setDriver}
        onAccepted={(r) => (setRide(r), setView('trips'))}
        onGo={setView}
        reload={loadLive}
      />
    );
  }

  const shell = {
    user,
    profile: { name: driver?.name || user.name, image: driver?.photo_url, Icon: Bike, roleLabel: driver?.is_online ? 'Conductor · Disponible' : 'Conductor' },
    nav: NAV,
    badges: { notifications: unread, trips: ride ? 1 : 0, home: !ride && driver?.is_online ? state.requests.length : 0 },
    view,
    onSelect: (key) => {
      setView(key);
      if (key === 'notifications') reloadNotices();
    },
    bell: {
      count: unread,
      label: `Notificaciones${unread ? `, ${unread} sin leer` : ''}`,
      onClick: () => {
        setView('notifications');
        reloadNotices();
      },
    },
    slogan,
    menuEnabled: allowed,
    onLogout,
  };

  return desktop ? (
    <PanelDesktop {...shell}>{content}</PanelDesktop>
  ) : (
    <PanelMobile {...shell} tabs={TABS}>
      {content}
    </PanelMobile>
  );
}

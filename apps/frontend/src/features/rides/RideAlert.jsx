import { CheckCircle2, Eye, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useNavigate, usePath } from '../../lib/router.jsx';
import { useNotifications } from '../notifications/NotificationsContext.jsx';
import { ridesApi } from './api.js';
import { usePolling } from './model.js';
import './ride-alert.css';

const WATCH_KEY = 'neirapp.transporte.viaje';
const MESSAGES = {
  accepted: (r) => ['¡Tu motocarro ha sido asignado!', `${r.driver?.name ?? 'Un conductor'} (${r.driver?.plate_label ?? ''}) va por ti.`],
  arrived: (r) => ['¡Tu motocarro llegó!', `${r.driver?.name ?? 'El conductor'} te espera en ${r.address}.`],
};

const watched = () => {
  try {
    return JSON.parse(localStorage.getItem(WATCH_KEY) ?? '""');
  } catch {
    return '';
  }
};

/**
 * Aviso flotante en cualquier pantalla de la app mientras el cliente espera su motocarro: cuando un conductor acepta
 * (o llega) aparece "¡Tu motocarro ha sido asignado!" con el botón "Mirar motocarro". En Transporte no se muestra
 * porque esa pantalla ya lo dice.
 */
export default function RideAlert() {
  const path = usePath();
  const navigate = useNavigate();
  const { reload } = useNotifications();
  const last = useRef({});
  const [alert, setAlert] = useState(null);

  const check = useCallback(async () => {
    const id = watched();
    if (!id) return;
    try {
      const ride = await ridesApi.get(id);
      const before = last.current[id];
      last.current[id] = ride.status;
      if (before && before !== ride.status && MESSAGES[ride.status]) {
        setAlert({ ride, text: MESSAGES[ride.status](ride) });
        reload();
      }
      if (!['requested', 'accepted', 'arrived', 'in_progress'].includes(ride.status)) localStorage.setItem(WATCH_KEY, '""');
    } catch {
      /* sin conexión: se vuelve a intentar */
    }
  }, [reload]);
  usePolling(check, 5000);

  if (!alert || path.startsWith('/transporte')) return null;
  const [title, body] = alert.text;
  return (
    <div className="ride-alert" role="alert">
      <CheckCircle2 size={30} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{body}</span>
      </div>
      <button
        type="button"
        className="ride-alert-go"
        onClick={() => {
          setAlert(null);
          navigate(`/transporte/viaje?id=${alert.ride.id}`);
        }}
      >
        <Eye size={16} aria-hidden="true" /> Mirar motocarro
      </button>
      <button type="button" className="ride-alert-x" aria-label="Cerrar" onClick={() => setAlert(null)}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

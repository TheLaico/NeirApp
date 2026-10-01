import { useEffect, useRef, useState } from 'react';
import { courierApi } from './api.js';

// Cada cuánto se manda la posición al servidor (ms). Más seguido gasta batería y datos; menos, se ve a saltos.
const SEND_EVERY = 5000;

/**
 * Comparte la ubicación del repartidor con NeirAPP mientras su panel esté abierto (`enabled`).
 * Devuelve el estado: 'idle' (sin empezar), 'sharing', 'denied' (no dio permiso) o 'unsupported'.
 * Solo el administrador ve esta posición, en su mapa en vivo.
 */
export function useShareLocation(enabled) {
  const [status, setStatus] = useState('idle');
  const lastSent = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!navigator.geolocation) {
      setStatus('unsupported');
      return undefined;
    }

    const send = ({ coords }) => {
      setStatus('sharing');
      const now = Date.now();
      if (now - lastSent.current < SEND_EVERY) return;
      lastSent.current = now;
      const heading = Number.isFinite(coords.heading) ? coords.heading : null;
      courierApi.sendLocation(coords.latitude, coords.longitude, heading).catch(() => {
        lastSent.current = 0; // que el siguiente punto se reintente enseguida
      });
    };
    const fail = (err) => setStatus(err.code === 1 ? 'denied' : 'idle');

    const id = navigator.geolocation.watchPosition(send, fail, { enableHighAccuracy: true, maximumAge: 4000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return status;
}

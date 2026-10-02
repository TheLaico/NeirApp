import { useEffect, useRef, useState } from 'react';
import motocarroIcon from '../../assets/Transporte/motocarro-icono.webp';
import { NEIRA_BOUNDS } from '../map/constants.js';

// Igual que la API: $ 2.500 por persona, hasta 3 personas por motocarro.
export const FARE_PER_PERSON = 2500;
export const MAX_PASSENGERS = 3;

export const STATUS = {
  requested: { label: 'Buscando motocarro', tone: 'wait' },
  accepted: { label: 'Motocarro en camino', tone: 'info' },
  arrived: { label: 'Tu motocarro llegó', tone: 'ok' },
  in_progress: { label: 'En viaje', tone: 'info' },
  completed: { label: 'Terminado', tone: 'ok' },
  cancelled: { label: 'Cancelado', tone: 'off' },
  expired: { label: 'Nadie aceptó', tone: 'bad' },
};
export const ACTIVE = ['requested', 'accepted', 'arrived', 'in_progress'];

/** ¿El punto está dentro del mapa de Neira de la app? (igual que la API). */
export const inNeira = (lat, lng) => lat >= NEIRA_BOUNDS[0][1] && lat <= NEIRA_BOUNDS[1][1] && lng >= NEIRA_BOUNDS[0][0] && lng <= NEIRA_BOUNDS[1][0];

// Punteros del mapa.
export const MOTOCARRO_MARKER = { image: motocarroIcon, color: '#0f5238' };
export const BUSY_MARKER = { image: motocarroIcon, color: '#9aa79f', size: 40 };

/** "3101234567" → "310 123 4567". */
export const phoneLabel = (raw = '') => {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('57')) digits = digits.slice(2);
  return digits.length === 10 ? digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3') : digits;
};
export const telLink = (digits = '') => `tel:+57${digits.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '')}`;
export const whatsappLink = (digits, text) => `https://wa.me/57${digits}?text=${encodeURIComponent(text)}`;
export const timeOf = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
export const dayTime = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const people = (n) => (n === 1 ? '1 persona' : `${n} personas`);

/** Llama `fn` ahora y cada `ms` mientras `active` sea verdadero (y la pestaña esté visible). */
export function usePolling(fn, ms, active = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return undefined;
    let stopped = false;
    const tick = () => !stopped && document.visibilityState !== 'hidden' && ref.current();
    tick();
    const timer = setInterval(tick, ms);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ms, active]);
}

/**
 * La ubicación del teléfono (GPS) mientras `active`. Devuelve { position, error }: `error` dice por qué no se pudo
 * (permiso negado, sin GPS o fuera de Neira) para pedirle a la persona que marque el punto en el mapa.
 */
export function useGeolocation(active = true) {
  const [state, setState] = useState({ position: null, error: '' });
  useEffect(() => {
    if (!active) return undefined;
    if (!navigator.geolocation) {
      setState({ position: null, error: 'Tu dispositivo no comparte la ubicación.' });
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const p = { lat: Number(coords.latitude.toFixed(6)), lng: Number(coords.longitude.toFixed(6)) };
        setState(inNeira(p.lat, p.lng) ? { position: p, error: '' } : { position: null, error: 'Tu ubicación queda por fuera de Neira.' });
      },
      (err) => setState({ position: null, error: err.code === 1 ? 'No diste permiso para usar tu ubicación.' : 'No pudimos leer tu ubicación.' }),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active]);
  return state;
}

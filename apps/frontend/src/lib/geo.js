import { NEIRA_BOUNDS } from '../features/map/constants.js';

// La entrega es solo en Neira: los límites del mapa más un margen de ~2 km para las veredas cercanas.
const PAD = 0.02;

export const isInsideDeliveryArea = ({ lat, lng }) =>
  lng > NEIRA_BOUNDS[0][0] - PAD &&
  lng < NEIRA_BOUNDS[1][0] + PAD &&
  lat > NEIRA_BOUNDS[0][1] - PAD &&
  lat < NEIRA_BOUNDS[1][1] + PAD;

/** Enlace para abrir un punto en OpenStreetMap (el repartidor lo ve en cualquier navegador). */
export const mapLink = ({ lat, lng }) =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;

/** Pide la ubicación actual al navegador. Rechaza con un mensaje en español listo para mostrar. */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Tu navegador no permite obtener la ubicación. Escribe la dirección a mano.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
        }),
      (err) => {
        const messages = {
          1: 'No diste permiso para usar tu ubicación. Actívalo en tu navegador o escribe la dirección a mano.',
          2: 'No pudimos detectar tu ubicación. Revisa que el GPS esté encendido o escribe la dirección.',
          3: 'Tardó demasiado en encontrar tu ubicación. Intenta de nuevo o escribe la dirección.',
        };
        reject(new Error(messages[err.code] ?? 'No pudimos obtener tu ubicación.'));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}

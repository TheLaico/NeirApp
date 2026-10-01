import { Marker } from 'maplibre-gl';
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { NeiraMap } from '../../features/map/NeiraMap.jsx';

/**
 * Mapa del sistema (el mismo de Neira) a pantalla completa con el destino marcado: la tienda o el cliente.
 * Si el repartidor permite su ubicación, también se marca dónde está y se encuadran ambos puntos.
 */
export default function DestinationMap({ title, subtitle, lat, lng, onClose }) {
  const mapRef = useRef(null);
  const meRef = useRef(null);

  const onMapReady = useCallback(
    (map) => {
      mapRef.current = map;
      map.jumpTo({ center: [lng, lat], zoom: 16 });
    },
    [lat, lng],
  );

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Ubicación del repartidor (opcional): si no la da o falla, el mapa queda centrado en el destino.
  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const map = mapRef.current;
        if (cancelled || !map) return;
        const dot = document.createElement('span');
        dot.className = 'cr-me';
        dot.setAttribute('aria-label', 'Tu ubicación');
        meRef.current = new Marker({ element: dot }).setLngLat([coords.longitude, coords.latitude]).addTo(map);
        const near = Math.abs(coords.latitude - lat) < 0.08 && Math.abs(coords.longitude - lng) < 0.08;
        if (near) {
          map.fitBounds(
            [
              [Math.min(lng, coords.longitude), Math.min(lat, coords.latitude)],
              [Math.max(lng, coords.longitude), Math.max(lat, coords.latitude)],
            ],
            { padding: 80, maxZoom: 17, duration: 600 },
          );
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
    return () => {
      cancelled = true;
      meRef.current?.remove();
    };
  }, [lat, lng]);

  return (
    <div className="cr-map-modal" role="dialog" aria-modal="true" aria-label={title}>
      <header className="cr-map-head">
        <div>
          <strong>{title}</strong>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <button type="button" className="cr-map-close" onClick={onClose} aria-label="Cerrar mapa">
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      <NeiraMap stores={[]} showBuildings onMapReady={onMapReady} pin={{ lat, lng }} className="cr-map" />
    </div>
  );
}

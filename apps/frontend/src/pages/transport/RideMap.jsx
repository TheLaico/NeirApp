import { LocateFixed, MapPin, Minus, Plus, UserRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { NEIRA_CENTER, NEIRA_ZOOM } from '../../features/map/constants.js';
import { NeiraMap } from '../../features/map/NeiraMap.jsx';
import { mapThemeFor } from '../../features/map/theme.js';
import { BUSY_MARKER, MOTOCARRO_MARKER } from '../../features/rides/model.js';
import { useSettings } from '../../features/settings/SettingsContext.jsx';

const CUSTOMER_MARKER = { Icon: UserRound, color: '#2f6fd6' };
const REQUEST_MARKER = { Icon: UserRound, color: '#e0662f' };

/**
 * El mapa de Neira de la app para Transporte. Muestra, según lo que se le pase:
 *  - `live`: motocarros en servicio (gris si ya llevan a alguien);
 *  - `pickup`: el punto de recogida (puntero naranja, se mueve tocando el mapa si hay `onPick`);
 *  - `customer`: dónde está el cliente ahora (azul);
 *  - `driver`: el motocarro asignado (con su placa), y la ruta punteada hasta el punto de recogida;
 *  - `requests`: solicitudes para el conductor (naranja), `onSelectRequest` al tocarlas.
 */
export default function RideMap({ live = [], pickup, customer, driver, requests = [], onPick, onSelectRequest, focus, legend = true, className = '' }) {
  const { prefs } = useSettings();
  const theme = mapThemeFor(prefs.mapNightAuto);
  const mapRef = useRef(null);

  const markers = useMemo(() => {
    const out = live.map((d, n) => ({ id: `live-${n}`, name: '', lat: d.lat, lng: d.lng, marker: d.busy ? BUSY_MARKER : MOTOCARRO_MARKER }));
    requests.forEach((r) => out.push({ id: r.id, name: r.label, lat: r.lat, lng: r.lng, marker: REQUEST_MARKER, active: r.active }));
    if (customer) out.push({ id: 'customer', name: customer.label ?? 'Cliente', lat: customer.lat, lng: customer.lng, marker: CUSTOMER_MARKER });
    if (driver?.lat) out.push({ id: 'driver', name: driver.label, lat: driver.lat, lng: driver.lng, marker: { ...MOTOCARRO_MARKER, size: 50 }, active: true });
    return out;
  }, [live, requests, customer, driver]);

  const line = useMemo(() => (driver?.lat && pickup ? [[driver.lng, driver.lat], [pickup.lng, pickup.lat]] : null), [driver, pickup]);
  const select = useCallback((m) => onSelectRequest?.(m.id), [onSelectRequest]);

  // Encuadra lo importante: el motocarro y el punto de recogida (o lo que haya).
  const fit = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const pts = [pickup, driver?.lat ? driver : null, customer, focus].filter(Boolean);
    if (pts.length === 0) return map.easeTo({ center: NEIRA_CENTER, zoom: NEIRA_ZOOM, duration: 700 });
    if (pts.length === 1) return map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 16.5, duration: 700 });
    const lngs = pts.map((p) => p.lng);
    const lats = pts.map((p) => p.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 80, maxZoom: 17, duration: 700 },
    );
  }, [pickup, driver, customer, focus]);

  const onMapReady = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Al asignarse un motocarro (o cambiar el foco) se encuadra de nuevo.
  const key = `${driver?.label ?? ''}-${focus?.lat ?? ''}-${focus?.lng ?? ''}`;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.loaded()) fit();
    else map.once('load', fit);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`tr-map ${className}`.trim()}>
      <NeiraMap stores={markers} onSelectStore={select} onMapReady={onMapReady} theme={theme} onPick={onPick} pin={pickup} line={line} className="tr-map-canvas" />
      <span className="tr-chip">
        <MapPin size={15} aria-hidden="true" /> Neira, Caldas
      </span>
      <div className="tr-map-ctrl">
        <button type="button" aria-label="Acercar" onClick={() => mapRef.current?.zoomIn()}>
          <Plus size={19} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Alejar" onClick={() => mapRef.current?.zoomOut()}>
          <Minus size={19} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Centrar" onClick={fit}>
          <LocateFixed size={19} aria-hidden="true" />
        </button>
      </div>
      {legend && (
        <ul className="tr-legend">
          {customer && (
            <li>
              <i className="blue" /> Tu ubicación
            </li>
          )}
          {(pickup || requests.length > 0) && (
            <li>
              <i className="orange" /> {requests.length ? 'Solicitudes activas' : 'Punto de recogida'}
            </li>
          )}
          <li>
            <i className="green" /> Motocarros en servicio
          </li>
        </ul>
      )}
    </div>
  );
}

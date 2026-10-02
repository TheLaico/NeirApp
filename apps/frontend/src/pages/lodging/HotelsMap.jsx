import { List, LocateFixed, MapPin, Minus, Navigation, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { RELIEF_BEARING, RELIEF_PITCH, STORE_ZOOM } from '../../features/map/constants.js';
import { NeiraMap, set3D } from '../../features/map/NeiraMap.jsx';
import { mapThemeFor } from '../../features/map/theme.js';
import { HOTEL_MARKER, directionsLink } from '../../features/lodging/model.js';
import { useSettings } from '../../features/settings/SettingsContext.jsx';

/**
 * El mismo mapa de Neira del inicio (relieve, día/noche), pero solo con los hoteles. Al tocar un puntero se elige
 * ese hotel; `focusKey` cambia cuando hay que volar hacia el elegido ("Ver en el mapa").
 */
export default function HotelsMap({ hotels, selectedId, onSelect, onList, focusKey = 0, className = '' }) {
  const { prefs } = useSettings();
  const theme = mapThemeFor(prefs.mapNightAuto);
  const mapRef = useRef(null);

  const markers = useMemo(
    () => hotels.map((h) => ({ id: h.id, name: h.name, lat: h.lat, lng: h.lng, marker: HOTEL_MARKER, active: h.id === selectedId })),
    [hotels, selectedId],
  );
  const pick = useCallback((m) => onSelect?.(m.id), [onSelect]);
  const selected = hotels.find((h) => h.id === selectedId);

  const fit = useCallback(() => {
    const map = mapRef.current;
    if (!map || !hotels.length) return;
    if (hotels.length === 1) {
      map.easeTo({ center: [hotels[0].lng, hotels[0].lat], zoom: STORE_ZOOM - 1, duration: 800 });
      return;
    }
    const lngs = hotels.map((h) => h.lng);
    const lats = hotels.map((h) => h.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 70, maxZoom: 16.5, pitch: RELIEF_PITCH, bearing: RELIEF_BEARING, duration: 800 },
    );
  }, [hotels]);

  const onMapReady = useCallback((map) => {
    mapRef.current = map;
    map.once('load', () => set3D(map, true));
  }, []);

  // "Ver en el mapa": centra el hotel elegido.
  useEffect(() => {
    const hotel = hotels.find((h) => h.id === selectedId);
    if (!focusKey || !hotel || !mapRef.current) return;
    mapRef.current.easeTo({ center: [hotel.lng, hotel.lat], zoom: STORE_ZOOM, duration: 900 });
  }, [focusKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`lg-map ${className}`.trim()}>
      <NeiraMap stores={markers} onSelectStore={pick} onMapReady={onMapReady} theme={theme} className="lg-map-canvas" />
      <div className="lg-map-chips">
        {onList && (
          <button type="button" className="lg-chip" onClick={onList}>
            <List size={16} aria-hidden="true" /> Ver lista
          </button>
        )}
        <span className="lg-chip static">
          <MapPin size={16} aria-hidden="true" /> Neira, Caldas
        </span>
      </div>
      {selected && (
        <a className="lg-map-route" href={directionsLink(selected)} target="_blank" rel="noreferrer">
          <Navigation size={17} aria-hidden="true" />
          <span>
            Cómo llegar{hotels.length > 1 && <small>{selected.name}</small>}
          </span>
        </a>
      )}
      <div className="lg-map-ctrl">
        <button type="button" aria-label="Acercar" onClick={() => mapRef.current?.zoomIn()}>
          <Plus size={20} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Alejar" onClick={() => mapRef.current?.zoomOut()}>
          <Minus size={20} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Ver todos los hoteles" onClick={fit}>
          <LocateFixed size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

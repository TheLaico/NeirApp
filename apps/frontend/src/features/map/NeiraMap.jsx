import 'maplibre-gl/dist/maplibre-gl.css';
import { Marker, MapLibreMap, addProtocol } from 'maplibre-gl';
import mlcontour from 'maplibre-contour';
import { useEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GROUPS } from '../stores/categories.jsx';
import { NEIRA_BOUNDS, NEIRA_CENTER, NEIRA_ZOOM } from './constants.js';
import { addLandmarks } from './landmarks.jsx';
import {
  BUILDING_LAYER_IDS,
  BUILDINGS_SOURCE_ID,
  buildingLayers,
  buildingsSource,
  buildStyle,
} from './style.js';

const TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

// Curvas de nivel calculadas en el navegador a partir de la elevación: [cada n m, línea marcada cada n m].
const CONTOUR_THRESHOLDS = { 11: [200, 1000], 12: [100, 500], 13: [100, 500], 14: [50, 200], 15: [20, 100], 16: [10, 50] };

let demSource = null;
function terrainSources() {
  if (!demSource) {
    demSource = new mlcontour.DemSource({ url: TERRARIUM, encoding: 'terrarium', maxzoom: 14, worker: false });
    addProtocol(demSource.sharedDemProtocolId, demSource.sharedDemProtocolV4);
    addProtocol(demSource.contourProtocolId, demSource.contourProtocolV4);
  }
  return {
    demTiles: demSource.sharedDemProtocolUrl,
    contourTiles: demSource.contourProtocolUrl({
      thresholds: CONTOUR_THRESHOLDS,
      contourLayer: 'contours',
      elevationKey: 'ele',
      levelKey: 'level',
      overzoom: 1,
    }),
  };
}

/** Muestra u oculta los edificios. La primera vez que se muestran se descargan y se agregan al mapa. */
export function setBuildings(map, on) {
  if (!map) return;
  if (on && !map.getSource(BUILDINGS_SOURCE_ID)) {
    map.addSource(BUILDINGS_SOURCE_ID, buildingsSource());
    // Por debajo de los rótulos de calles, encima de las calles
    const before = map.getLayer('road-labels') ? 'road-labels' : undefined;
    buildingLayers().forEach((layer) => map.addLayer(layer, before));
    return;
  }
  BUILDING_LAYER_IDS.forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  });
}

/** Activa o desactiva la vista en relieve (mapa inclinado con terreno en 3D). */
export function set3D(map, on) {
  if (!map) return;
  if (on) {
    map.setTerrain({ source: 'dem', exaggeration: 1.5 });
    map.easeTo({ pitch: 50, bearing: -18, duration: 1100 });
  } else {
    map.easeTo({ pitch: 0, bearing: 0, duration: 900 });
    map.once('moveend', () => map.setTerrain(null));
  }
}

// Marcador en forma de gota, con el color e icono del grupo de la tienda.
function markerElement(store) {
  const { Icon, color } = GROUPS[store.group] ?? GROUPS.mercados;
  const el = document.createElement('div');
  el.style.cursor = 'pointer';
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', store.name);
  el.innerHTML = renderToStaticMarkup(
    <span
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 34,
        height: 34,
        borderRadius: '50% 50% 50% 0',
        transform: 'rotate(-45deg)',
        border: '2px solid white',
        boxShadow: '0 2px 6px rgba(32,39,36,.3)',
        backgroundColor: color,
        opacity: store.is_open === false ? 0.5 : 1,
      }}
    >
      <span style={{ display: 'grid', transform: 'rotate(45deg)' }}>
        <Icon size={16} color="#fff" />
      </span>
    </span>,
  );

  // Nombre de la tienda junto al puntero. Se crea con textContent para que un nombre con símbolos no inyecte HTML.
  const label = document.createElement('span');
  label.className = 'store-label';
  label.textContent = store.name;
  el.appendChild(label);
  return el;
}

// Con el mapa muy alejado los nombres se amontonarían: solo se muestran desde este zoom.
const LABELS_MIN_ZOOM = 14.5;

/** `onMapReady` recibe la instancia del mapa (para los controles de zoom de la interfaz). */
export function NeiraMap({ stores, onSelectStore, onMapReady, showBuildings = true, onPick, pin, className = '' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const readyRef = useRef(onMapReady);
  readyRef.current = onMapReady;
  const buildingsRef = useRef(showBuildings);
  buildingsRef.current = showBuildings;

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: buildStyle(terrainSources()),
      center: NEIRA_CENTER,
      zoom: NEIRA_ZOOM,
      minZoom: 13,
      maxZoom: 19,
      maxPitch: 60,
      maxBounds: NEIRA_BOUNDS,
      attributionControl: false,
    });
    mapRef.current = map;
    readyRef.current?.(map);

    const toggleLabels = () => map.getContainer().classList.toggle('store-labels', map.getZoom() >= LABELS_MIN_ZOOM);
    map.on('zoom', toggleLabels);
    toggleLabels();
    if (import.meta.env.DEV) map.on('error', (e) => console.warn('[mapa]', e.error?.message ?? e.message ?? e));

    // Nombres y sitios del pueblo (marcadores HTML con la tipografía de la marca)
    let removeLandmarks = () => {};
    let disposed = false;
    map.once('load', () => {
      if (buildingsRef.current) setBuildings(map, true);
      addLandmarks(map)
        .then((cleanup) => (disposed ? cleanup() : (removeLandmarks = cleanup)))
        .catch(() => {});
    });
    // Al abrir el detalle de una tienda el mapa se angosta: hay que re-ajustar el canvas.
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);
    return () => {
      disposed = true;
      map.off('zoom', toggleLabels);
      removeLandmarks();
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Botón "edificios": mostrar u ocultar (si el mapa aún no cargó, lo aplica el evento 'load').
  useEffect(() => {
    const map = mapRef.current;
    if (map?.loaded()) setBuildings(map, showBuildings);
  }, [showBuildings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    markersRef.current = stores.map((store) => {
      const marker = new Marker({ element: markerElement(store), anchor: 'bottom' })
        .setLngLat([store.lng, store.lat])
        .addTo(map);
      marker.getElement().addEventListener('click', () => onSelectStore?.(store));
      return marker;
    });
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [stores, onSelectStore]);

  // Modo "elegir ubicación": un clic en el mapa llama a onPick y un marcador muestra el punto elegido.
  const pinRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onPick) return undefined;
    const handle = (e) => onPickRef.current?.(Number(e.lngLat.lat.toFixed(6)), Number(e.lngLat.lng.toFixed(6)));
    map.on('click', handle);
    map.getCanvas().style.cursor = 'crosshair';
    return () => {
      map.off('click', handle);
      map.getCanvas().style.cursor = '';
    };
  }, [Boolean(onPick)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pin) {
      if (pinRef.current) pinRef.current.setLngLat([pin.lng, pin.lat]);
      else pinRef.current = new Marker({ color: '#B6533C' }).setLngLat([pin.lng, pin.lat]).addTo(map);
    } else {
      pinRef.current?.remove();
      pinRef.current = null;
    }
  }, [pin]);

  return <div ref={containerRef} className={className} role="application" aria-label="Mapa de Neira" />;
}

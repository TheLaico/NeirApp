import { Bike, Check, Crosshair, House } from 'lucide-react';
import { Marker } from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { courierApi, usePolled, vehicleLabel } from '../../features/courier/api.js';
import { NeiraMap } from '../../features/map/NeiraMap.jsx';
import AdminLayout from './AdminLayout.jsx';
import './admin-live-map.css';

const REFRESH_MS = 4000;
const NO_STORES = []; // el mapa del administrador no muestra los negocios: solo a los repartidores y su ruta
const ROUTE_SOURCE = 'live-route';

const ago = (iso) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  return `hace ${Math.round(s / 3600)} h`;
};

// Estado de un repartidor para el color del marcador y la lista.
const stateOf = (c) => {
  if (!c.is_online) return { key: 'offline', label: 'Sin señal' };
  if (c.active_order_id) return { key: 'busy', label: 'En entrega' };
  return { key: 'free', label: 'Disponible' };
};

function markerElement(courier) {
  const state = stateOf(courier).key;
  const el = document.createElement('div');
  el.className = `live-courier ${state}`;
  // El elemento raíz lo posiciona MapLibre con `transform`: no se le puede aplicar escala ni transiciones. Lo visual va en `.live-courier-dot`.
  el.innerHTML = `<span class="live-courier-dot">${renderToStaticMarkup(<Bike size={20} color="#fff" />)}</span><span class="live-courier-name"></span>`;
  el.querySelector('.live-courier-name').textContent = courier.name.split(' ')[0];
  return el;
}

// Tiendas y casa del cliente de la entrega de un repartidor.
function destinationElement(kind, index, label, done) {
  const el = document.createElement('div');
  el.className = `live-dest ${kind}${done ? ' done' : ''}`;
  const icon = kind === 'house' ? renderToStaticMarkup(<House size={18} color="#fff" />) : done ? renderToStaticMarkup(<Check size={18} color="#fff" />) : `<b>${index}</b>`;
  el.innerHTML = `<span class="live-dest-dot">${icon}</span><span class="live-dest-label"></span>`;
  el.querySelector('.live-dest-label').textContent = label;
  return el;
}

/** Puntos por los que pasa la ruta: tiendas pendientes, en orden, y la casa. */
function routePoints(courier) {
  const pending = courier.stops.filter((s) => !s.is_picked_up).map((s) => [s.lng, s.lat]);
  const house = courier.delivery_lat != null ? [[courier.delivery_lng, courier.delivery_lat]] : [];
  return [[courier.lng, courier.lat], ...pending, ...house];
}

/** Dibuja (o borra, con `coords = []`) la línea de la ruta. Espera a que el estilo del mapa esté cargado. */
function drawRoute(map, coords) {
  const apply = () => {
    const data = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords.length > 1 ? coords : [] } };
    if (!map.getSource(ROUTE_SOURCE)) {
      map.addSource(ROUTE_SOURCE, { type: 'geojson', data });
      map.addLayer({ id: ROUTE_SOURCE, type: 'line', source: ROUTE_SOURCE, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#e8531c', 'line-width': 4, 'line-dasharray': [1.5, 1.5], 'line-opacity': 0.9 } });
    } else {
      map.getSource(ROUTE_SOURCE).setData(data);
    }
  };
  // `isStyleLoaded()` da falso mientras se descargan teselas, así que se intenta directo y solo si el estilo aún no existe se espera.
  try {
    apply();
  } catch {
    map.once('load', apply);
  }
}

/** Panel de administrador: mapa en tiempo real con la posición de los repartidores. Se actualiza solo cada pocos segundos. */
export default function AdminLiveMapPage({ user, onLogout }) {
  const live = usePolled(courierApi.live, { every: REFRESH_MS });
  const couriers = live.data ?? [];
  const mapRef = useRef(null);
  const markers = useRef(new Map()); // courier_id → { marker, state }
  const destMarkers = useRef([]); // tiendas y casa del repartidor elegido
  const [selected, setSelected] = useState(null);
  const [tick, setTick] = useState(0); // para que "hace X s" avance entre consultas

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const onMapReady = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Mantiene un marcador por repartidor: lo crea, lo mueve y lo quita cuando ya no aparece.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set();
    for (const c of couriers) {
      seen.add(c.courier_id);
      const state = stateOf(c).key;
      const existing = markers.current.get(c.courier_id);
      if (existing && existing.state === state) {
        existing.marker.setLngLat([c.lng, c.lat]);
        continue;
      }
      existing?.marker.remove();
      const el = markerElement(c);
      el.addEventListener('click', () => setSelected((cur) => (cur === c.courier_id ? null : c.courier_id)));
      const marker = new Marker({ element: el, anchor: 'center' }).setLngLat([c.lng, c.lat]).addTo(map);
      markers.current.set(c.courier_id, { marker, state });
    }
    for (const [id, { marker }] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
  }, [couriers]);

  useEffect(
    () => () => {
      markers.current.forEach(({ marker }) => marker.remove());
      markers.current.clear();
    },
    [],
  );

  // El marcador elegido se resalta.
  useEffect(() => {
    markers.current.forEach(({ marker }, id) => marker.getElement().classList.toggle('selected', id === selected));
  }, [selected, couriers]);

  const chosen = couriers.find((c) => c.courier_id === selected) ?? null;

  // Al elegir un repartidor se muestran las tiendas donde debe recoger y la casa donde entrega, unidas por su ruta.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    destMarkers.current.forEach((m) => m.remove());
    destMarkers.current = [];
    if (!chosen || !chosen.active_order_id) {
      drawRoute(map, []);
      return;
    }
    chosen.stops.forEach((s, i) => {
      const el = destinationElement('store', i + 1, s.store_name, s.is_picked_up);
      destMarkers.current.push(new Marker({ element: el, anchor: 'center' }).setLngLat([s.lng, s.lat]).addTo(map));
    });
    if (chosen.delivery_lat != null) {
      const el = destinationElement('house', 0, 'Casa del cliente', false);
      destMarkers.current.push(new Marker({ element: el, anchor: 'center' }).setLngLat([chosen.delivery_lng, chosen.delivery_lat]).addTo(map));
    }
    drawRoute(map, routePoints(chosen));
  }, [chosen]);

  useEffect(
    () => () => {
      destMarkers.current.forEach((m) => m.remove());
    },
    [],
  );

  const focus = (c) => {
    const map = mapRef.current;
    if (selected === c.courier_id) {
      setSelected(null); // tocar de nuevo al mismo repartidor quita su ruta
      return;
    }
    setSelected(c.courier_id);
    if (!map) return;
    const points = c.active_order_id ? routePoints(c) : [];
    if (points.length > 1) {
      const lngs = points.map((p) => p[0]);
      const lats = points.map((p) => p[1]);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 90, maxZoom: 17, duration: 700 });
    } else {
      map.easeTo({ center: [c.lng, c.lat], zoom: Math.max(map.getZoom(), 16), duration: 700 });
    }
  };

  const online = couriers.filter((c) => c.is_online).length;
  const busy = couriers.filter((c) => c.is_online && c.active_order_id).length;

  return (
    <AdminLayout
      user={user}
      onLogout={onLogout}
      title="Mapa en vivo"
      subtitle="Dónde está cada repartidor ahora mismo. La posición se actualiza sola cada pocos segundos mientras su panel está abierto."
    >
      <div className="live-summary">
        <span className="a-badge server">{online} en línea</span>
        <span className="a-badge local">{busy} en entrega</span>
        <span className="a-badge">{couriers.length - online} sin señal</span>
      </div>

      {live.error && !live.data && (
        <p className="a-err" role="alert">
          {live.error}
        </p>
      )}

      <div className="live-layout">
        <div className="live-map">
          <NeiraMap stores={NO_STORES} showBuildings={false} bearing={0} onMapReady={onMapReady} className="live-map-canvas" />
          {live.data && couriers.length === 0 && <p className="live-empty">Ningún repartidor ha compartido su ubicación todavía.</p>}
        </div>

        <ul className="live-list" aria-label="Repartidores" data-tick={tick}>
          {couriers.map((c) => {
            const state = stateOf(c);
            return (
              <li key={c.courier_id}>
                <button type="button" className={`live-item${selected === c.courier_id ? ' selected' : ''}`} onClick={() => focus(c)}>
                  <span className={`live-dot ${state.key}`} aria-hidden="true" />
                  <span className="live-item-text">
                    <strong>{c.name}</strong>
                    <small>
                      {vehicleLabel(c.vehicle_type)}
                      {c.plate ? ` · ${c.plate}` : ''} · {state.label}
                    </small>
                    {c.active_order_id && (
                      <small>
                        Pedido #{c.active_order_id.slice(0, 6).toUpperCase()} · {c.stops_picked_up}/{c.stops_total} recogidas
                      </small>
                    )}
                    <small>{ago(c.updated_at)}</small>
                    {selected === c.courier_id && c.active_order_id && (
                      <ol className="live-route">
                        {c.stops.map((s, i) => (
                          <li key={i} className={s.is_picked_up ? 'done' : ''}>
                            {s.is_picked_up ? '✓' : `${i + 1}.`} {s.store_name}
                          </li>
                        ))}
                        <li className="house">Casa del cliente</li>
                      </ol>
                    )}
                  </span>
                  <Crosshair size={18} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </AdminLayout>
  );
}

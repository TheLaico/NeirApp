import { Building2, ChevronDown, LocateFixed, MapPin, Minus, Mountain, Plus, X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import AppShell from '../../components/layout/AppShell.jsx';
import ProductScreen from '../../components/products/ProductScreen.jsx';
import StoreScreen from '../../components/products/StoreScreen.jsx';
import MapAmbience from '../../features/map/MapAmbience.jsx';
import { NeiraMap, set3D } from '../../features/map/NeiraMap.jsx';
import { NEIRA_CENTER, NEIRA_ZOOM, STORE_ZOOM } from '../../features/map/constants.js';
import { useSettings } from '../../features/settings/SettingsContext.jsx';
import { useStores } from '../../features/stores/api.js';
import { usePersistentState } from '../../lib/usePersistentState.js';
import StorePanel from './StorePanel.jsx';

const normalize = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Página de inicio: mapa de Neira con el catálogo de tiendas y productos. */
export default function HomePage({ user, onLogout }) {
  const { stores, status } = useStores();
  const [group, setGroup] = useState(null);
  const [query, setQuery] = useState('');
  const { prefs } = useSettings();
  const [showHint, setShowHint] = useState(prefs.mapHint);
  const [selectedId, setSelectedId] = useState(null);
  const [product, setProduct] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false); // pantalla "Ver tienda"
  const [relief, setRelief] = useState(false);
  // Edificios: visibles por defecto en computador y ocultos en pantallas pequeñas (más liviano en celulares).
  // Una vez que el usuario elige, se recuerda su preferencia.
  const [buildingsPref, setBuildingsPref] = usePersistentState('neirapp.frontend.map.buildings', null);
  const showBuildings = buildingsPref ?? !window.matchMedia('(max-width: 1023px)').matches;
  const mapRef = useRef(null);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return stores.filter(
      (s) => (!group || s.group === group) && (!q || normalize(`${s.name} ${s.label}`).includes(q)),
    );
  }, [stores, group, query]);

  const onMapReady = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const selected = stores.find((s) => s.id === selectedId) ?? null;
  const productStore = product ? stores.find((s) => s.id === product.store_id) ?? null : null;

  // Al elegir una tienda se abre su catálogo y el mapa se centra en ella.
  const openStore = useCallback((store) => {
    setSelectedId(store.id);
    setProduct(null);
    setInfoOpen(false);
    // easeTo (no flyTo): flyTo aleja la cámara a mitad de camino antes de acercarse.
    const map = mapRef.current;
    map?.easeTo({ center: [store.lng, store.lat], zoom: Math.max(map.getZoom(), STORE_ZOOM), duration: 900 });
  }, []);

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      group={group}
      onGroup={setGroup}
      query={query}
      onQuery={setQuery}
      className={selected ? 'has-store' : ''}
    >
      <main className="map-cell">
        <section className="map-card" aria-label="Mapa de Neira">
          <NeiraMap stores={visible} onSelectStore={openStore} onMapReady={onMapReady} showBuildings={showBuildings} className="map" />
          <MapAmbience />

          {selected && infoOpen && <StoreScreen key={selected.id} store={selected} onClose={() => setInfoOpen(false)} />}

          {productStore && (
            <ProductScreen
              key={product.id}
              product={product}
              store={productStore}
              onClose={() => setProduct(null)}
            />
          )}

          {showHint && (
            <div className="map-hint" role="status">
              <span className="hint-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="26" height="26">
                  <path
                    d="M12 22 C12 22 4.5 14.6 4.5 9.4 C4.5 5.3 7.9 2 12 2 C16.1 2 19.5 5.3 19.5 9.4 C19.5 14.6 12 22 12 22 Z"
                    fill="#0f5238"
                  />
                  <circle cx="12" cy="9.4" r="3.2" fill="#fff" />
                </svg>
              </span>
              <div>
                <strong>Explora las tiendas</strong>
                <p>
                  Toca un marcador para ver su catálogo
                  <br />y hacer tu pedido.
                </p>
              </div>
              <button
                type="button"
                className="hint-close"
                aria-label="Cerrar notificación"
                onClick={() => setShowHint(false)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="map-controls">
            <div className="map-zoom">
              <button type="button" aria-label="Acercar" onClick={() => mapRef.current?.zoomIn()}>
                <Plus size={22} />
              </button>
              <button type="button" aria-label="Alejar" onClick={() => mapRef.current?.zoomOut()}>
                <Minus size={22} />
              </button>
            </div>
            <button
              type="button"
              className="map-locate"
              aria-label="Centrar en Neira"
              onClick={() => mapRef.current?.easeTo({ center: NEIRA_CENTER, zoom: NEIRA_ZOOM, duration: 900 })}
            >
              <LocateFixed size={22} />
            </button>
            <button
              type="button"
              className={`map-locate${relief ? ' on' : ''}`}
              aria-label={relief ? 'Volver a la vista plana' : 'Ver en relieve 3D'}
              aria-pressed={relief}
              title={relief ? 'Vista plana' : 'Vista en relieve 3D'}
              onClick={() => {
                set3D(mapRef.current, !relief);
                setRelief(!relief);
              }}
            >
              <Mountain size={22} />
            </button>
            <button
              type="button"
              className={`map-locate${showBuildings ? ' on' : ''}`}
              aria-label={showBuildings ? 'Ocultar edificios' : 'Mostrar edificios'}
              aria-pressed={showBuildings}
              title={showBuildings ? 'Ocultar edificios (más liviano)' : 'Mostrar edificios'}
              onClick={() => setBuildingsPref(!showBuildings)}
            >
              <Building2 size={22} />
            </button>
          </div>

          <button type="button" className="map-place">
            <MapPin size={30} fill="#0f5238" color="#0f5238" aria-hidden="true" />
            <span>
              <strong>Neira, Caldas</strong>
              <small>Solo tiendas de este municipio</small>
            </span>
            <ChevronDown size={20} aria-hidden="true" />
          </button>

          <div className="map-support" aria-hidden="true">
            <span>
              Apoya
              <br />
              el comercio local
            </span>
            <svg viewBox="0 0 24 22" width="26" height="24">
              <path
                d="M12 20 C4 13 2 9 2 6.5 C2 3.5 4.5 2 7 2 C9 2 11 3.3 12 5 C13 3.3 15 2 17 2 C19.5 2 22 3.5 22 6.5 C22 9 20 13 12 20 Z"
                fill="none"
                stroke="#0f5238"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </section>
      </main>

      <StorePanel
        stores={visible}
        onSelect={openStore}
        status={status}
        selected={selected}
        onBack={() => {
          setSelectedId(null);
          setProduct(null);
          setInfoOpen(false);
        }}
        selectedProductId={product?.id}
        onOpenProduct={(p) => {
          setInfoOpen(false);
          setProduct(p);
        }}
        overlayOpen={Boolean(product) || infoOpen}
        onOpenInfo={() => {
          setProduct(null);
          setInfoOpen(true);
        }}
      />
    </AppShell>
  );
}

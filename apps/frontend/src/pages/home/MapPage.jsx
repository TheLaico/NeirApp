import { Building2, ChevronDown, LocateFixed, Menu, Minus, Mountain, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../../components/layout/AppShell.jsx';
import ProductScreen from '../../components/products/ProductScreen.jsx';
import StoreScreen from '../../components/products/StoreScreen.jsx';
import fondoBuscador from '../../assets/fondo-buscador.png';
import MapAmbience from '../../features/map/MapAmbience.jsx';
import { NeiraMap, set3D } from '../../features/map/NeiraMap.jsx';
import { NEIRA_BEARING, NEIRA_CENTER, NEIRA_ZOOM, RELIEF_BEARING, RELIEF_PITCH, STORE_ZOOM } from '../../features/map/constants.js';
import { mapThemeFor } from '../../features/map/theme.js';
import { useSettings } from '../../features/settings/SettingsContext.jsx';
import { useStores } from '../../features/stores/api.js';
import { usePersistentState } from '../../lib/usePersistentState.js';
import MapSearchResults from './MapSearchResults.jsx';
import StorePanel from './StorePanel.jsx';

const normalize = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Ejemplos que se "escriben" solos en el buscador del mapa mientras está vacío.
const SEARCH_EXAMPLES = ['pizza', 'pan de queso', 'una droguería', 'café', 'empanadas', 'hamburguesa', 'frutas'];

/**
 * Productos que coinciden con la búsqueda, agrupados por tienda (id de tienda -> productos). Se pide a la API con
 * una pausa corta para no consultar en cada letra. Solo cuentan los que coinciden por su nombre o descripción (la
 * API también devuelve los de una tienda cuyo nombre coincide, y esos no deben filtrar su catálogo).
 */
function useProductHits(query) {
  const [state, setState] = useState({ q: '', byStore: new Map(), loading: false });
  useEffect(() => {
    const q = query.trim();
    if (normalize(q).length < 2) {
      setState({ q: '', byStore: new Map(), loading: false });
      return undefined;
    }
    setState((s) => ({ ...s, loading: true }));
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/v1/products/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : []))
        .then((results) => {
          const needle = normalize(q);
          const byStore = new Map();
          for (const { product } of results) {
            if (!normalize(`${product.name} ${product.description ?? ''}`).includes(needle)) continue;
            if (!byStore.has(product.store_id)) byStore.set(product.store_id, []);
            byStore.get(product.store_id).push(product);
          }
          setState({ q, byStore, loading: false });
        })
        .catch((err) => {
          if (err.name !== 'AbortError') setState({ q, byStore: new Map(), loading: false });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return state;
}

/**
 * Página "Mapa": mapa de Neira con el catálogo de tiendas y productos.
 * Antes vivía en "/" (el inicio); ahora el inicio es un resumen (ver HomePage.jsx) y esta es "/mapa".
 * Si la URL trae `?tienda=<id>`, abre esa tienda apenas cargan las tiendas (así "Ver mapa" o una marca
 * del inicio pueden llevar directo a una tienda concreta).
 */
export default function MapPage({ user, onLogout }) {
  const { stores, status } = useStores();
  const [group, setGroup] = useState(null);
  const [query, setQuery] = useState('');
  const { prefs } = useSettings();
  const [showHint, setShowHint] = useState(prefs.mapHint);
  // El aviso del mapa se descarta deslizándolo hacia la izquierda (o con la X).
  const [hintDx, setHintDx] = useState(0);
  const [hintReady, setHintReady] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches); // ya terminó de entrar: desde aquí manda el arrastre (sin animación de entrada, ya desde el inicio)
  const hintDrag = useRef(null);
  const onHintDown = (e) => {
    if (e.target.closest('button')) return;
    hintDrag.current = { x: e.clientX, id: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onHintMove = (e) => {
    if (!hintDrag.current) return;
    setHintDx(Math.min(0, e.clientX - hintDrag.current.x)); // solo hacia la izquierda
  };
  const onHintUp = (e) => {
    if (!hintDrag.current) return;
    const dx = Math.min(0, e.clientX - hintDrag.current.x);
    hintDrag.current = null;
    if (dx < -70) {
      setHintDx(-600); // sale del todo y se quita
      setTimeout(() => setShowHint(false), 200);
    } else {
      setHintDx(0);
    }
  };
  const [selectedId, setSelectedId] = useState(null);
  const [product, setProduct] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false); // pantalla "Ver tienda"
  // El mapa arranca en relieve 3D (inclinado, con terreno); el botón de la montaña alterna con la vista plana.
  const [relief, setRelief] = useState(true);
  // Zoom, relieve, centrar y edificios viven guardados detrás de este botón de hamburguesa translúcido.
  const [controlsOpen, setControlsOpen] = useState(false);
  // Edificios: visibles por defecto en computador y ocultos en pantallas pequeñas (más liviano en celulares).
  // Una vez que el usuario elige, se recuerda su preferencia.
  const [buildingsPref, setBuildingsPref] = usePersistentState('neirapp.frontend.map.buildings', null);
  // Los usuarios con rol de cliente no tienen la opción de edificios: el mapa siempre va sin ellos.
  const canToggleBuildings = user.role !== 'customer';
  const showBuildings = canToggleBuildings && (buildingsPref ?? !window.matchMedia('(max-width: 1023px)').matches);
  const mapRef = useRef(null);

  // Mapa nocturno: solo si el usuario lo activó en Ajustes, y solo mientras de verdad es de noche. Se
  // revisa cada tanto por si el usuario deja la app abierta cruzando esa franja horaria.
  const [theme, setTheme] = useState(() => mapThemeFor(prefs.mapNightAuto));
  useEffect(() => {
    setTheme(mapThemeFor(prefs.mapNightAuto));
    if (!prefs.mapNightAuto) return undefined;
    const id = setInterval(() => setTheme(mapThemeFor(prefs.mapNightAuto)), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [prefs.mapNightAuto]);

  // Búsqueda: tiendas por nombre o categoría, y tiendas que venden lo buscado (p. ej. "pizza"). En el mapa y en la
  // lista quedan solo esas; al abrir una que vende lo buscado, su catálogo llega filtrado.
  const searchText = query.trim();
  const hits = useProductHits(query);
  const [resultsOpen, setResultsOpen] = useState(false);
  const nameMatches = useMemo(() => {
    const q = normalize(searchText);
    return q ? stores.filter((s) => normalize(`${s.name} ${s.label}`).includes(q)) : [];
  }, [stores, searchText]);
  const productMatches = useMemo(
    () => stores.filter((s) => hits.byStore.has(s.id)).map((s) => ({ store: s, products: hits.byStore.get(s.id) })),
    [stores, hits],
  );
  const visible = useMemo(() => {
    const names = new Set(nameMatches.map((s) => s.id));
    return stores.filter((s) => (!group || s.group === group) && (!searchText || names.has(s.id) || hits.byStore.has(s.id)));
  }, [stores, group, searchText, nameMatches, hits]);

  // Los accesos directos se cierran al tocar fuera del buscador y vuelven al tocarlo de nuevo.
  useEffect(() => {
    const onDown = (e) => setResultsOpen(Boolean(e.target.closest?.('.search-wrap')));
    const onKey = (e) => e.key === 'Escape' && setResultsOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('focusin', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('focusin', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const onMapReady = useCallback((map) => {
    mapRef.current = map;
    map.once('load', () => set3D(map, true));
  }, []);

  const selected = stores.find((s) => s.id === selectedId) ?? null;
  const productStore = product ? stores.find((s) => s.id === product.store_id) ?? null : null;

  // Solo en celular y tableta el catálogo queda debajo del mapa: al elegir una tienda la página baja un poco para
  // mostrarlo, y al volver sube de nuevo al mapa. En computador el catálogo ya está al lado.
  const isCompact = () => window.matchMedia('(max-width: 1023px)').matches;
  const scrollToCatalog = () => {
    if (!isCompact()) return;
    setTimeout(() => document.querySelector('.store-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };
  const scrollToMap = () => {
    if (isCompact()) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Al elegir una tienda se abre su catálogo y el mapa se centra en ella.
  const openStore = useCallback((store) => {
    setSelectedId(store.id);
    setProduct(null);
    setInfoOpen(false);
    // easeTo (no flyTo): flyTo aleja la cámara a mitad de camino antes de acercarse.
    const map = mapRef.current;
    map?.easeTo({ center: [store.lng, store.lat], zoom: Math.max(map.getZoom(), STORE_ZOOM), duration: 900 });
    scrollToCatalog();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Llegada desde "Ver mapa" o una marca del inicio con una tienda concreta (?tienda=<id>). Desde "Productos
  // recomendados" llega además el producto (?producto=<id>): se abre su ficha, lista para agregarlo al carrito.
  const [deepLinkId] = useState(() => new URLSearchParams(window.location.search).get('tienda'));
  const [deepLinkProduct] = useState(() => new URLSearchParams(window.location.search).get('producto'));
  useEffect(() => {
    if (!deepLinkId || status !== 'ok') return;
    const store = stores.find((s) => s.id === deepLinkId);
    if (store) {
      openStore(store);
      if (deepLinkProduct) {
        fetch(`/api/v1/stores/${store.id}/products`)
          .then((res) => (res.ok ? res.json() : []))
          .then((list) => {
            const found = list.find((p) => p.id === deepLinkProduct);
            if (found) setProduct(found);
          })
          .catch(() => {});
      }
    }
    window.history.replaceState(null, '', '/mapa');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkId, status, stores]);

  return (
    <AppShell
      user={user}
      onLogout={onLogout}
      group={group}
      onGroup={setGroup}
      query={query}
      onQuery={(q) => {
        setQuery(q);
        setResultsOpen(true);
      }}
      searchExamples={SEARCH_EXAMPLES}
      searchResults={
        resultsOpen && normalize(searchText).length >= 1 ? (
          <MapSearchResults
            query={searchText}
            byName={nameMatches}
            byProduct={productMatches}
            loading={hits.loading}
            onOpen={(store) => {
              setResultsOpen(false);
              setGroup(null);
              openStore(store);
            }}
          />
        ) : null
      }
      className={`map-view ${selected ? 'has-store' : ''}`.trim()}
      heroImage={fondoBuscador}
    >
      <main className="map-cell">
        <section className="map-card" aria-label="Mapa de Neira">
          <NeiraMap stores={visible} onSelectStore={openStore} onMapReady={onMapReady} showBuildings={showBuildings} theme={theme} className="map" />
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
            <div
              className={`map-hint${hintReady ? ' ready' : ''}${hintDx === -600 ? ' leaving' : ''}${hintDrag.current ? ' dragging' : ''}`}
              role="status"
              style={hintReady ? { transform: `translateX(${hintDx}px)`, opacity: hintDx === -600 ? 0 : 1 + hintDx / 400 } : undefined}
              onAnimationEnd={() => setHintReady(true)}
              onPointerDown={onHintDown}
              onPointerMove={onHintMove}
              onPointerUp={onHintUp}
              onPointerCancel={onHintUp}
            >
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
            <button
              type="button"
              className={`map-controls-toggle${controlsOpen ? ' on' : ''}`}
              aria-label={controlsOpen ? 'Cerrar controles del mapa' : 'Controles del mapa'}
              aria-expanded={controlsOpen}
              onClick={() => setControlsOpen((v) => !v)}
            >
              <Menu size={22} />
            </button>

            {controlsOpen && (
              <div className="map-controls-panel">
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
                  onClick={() =>
                    mapRef.current?.easeTo({
                      center: NEIRA_CENTER,
                      zoom: NEIRA_ZOOM,
                      // Vuelve a la perspectiva que se está usando: relieve (inclinada) o plana.
                      pitch: relief ? RELIEF_PITCH : 0,
                      bearing: relief ? RELIEF_BEARING : NEIRA_BEARING,
                      duration: 900,
                    })
                  }
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
                {canToggleBuildings && (
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
                )}
              </div>
            )}
          </div>

          {/* Solo en celular/tableta: ahí el mapa ocupa toda la pantalla y responde al arrastre con
              paneo/zoom en vez de dejar pasar el scroll, así que deslizar hacia abajo mueve el mapa en
              lugar de la página. Este botón baja hasta el catálogo de tiendas como si hubiera scroll. */}
          <button
            type="button"
            className="map-scroll-down"
            aria-label="Ver el catálogo de tiendas"
            onClick={() => document.querySelector('.panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <ChevronDown size={24} />
          </button>
        </section>
      </main>

      <StorePanel
        user={user}
        stores={visible}
        onSelect={openStore}
        status={status}
        selected={selected}
        onBack={() => {
          setSelectedId(null);
          setProduct(null);
          setInfoOpen(false);
          scrollToMap();
        }}
        selectedProductId={product?.id}
        onOpenProduct={(p) => {
          setInfoOpen(false);
          setProduct(p);
        }}
        overlayOpen={Boolean(product) || infoOpen}
        searchLabel={searchText}
        detailQuery={selected && hits.byStore.has(selected.id) ? searchText : ''}
        onOpenInfo={() => {
          setProduct(null);
          setInfoOpen(true);
        }}
      />
    </AppShell>
  );
}

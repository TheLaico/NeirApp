import { Marker } from 'maplibre-gl';
import { Mountain, Trees } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NEIRA_BOUNDS } from './constants.js';

/**
 * Sitios y nombres del pueblo (datos reales de OpenStreetMap) como marcadores HTML, para poder usar la
 * tipografía de la marca. Cada marcador tiene un rango de zoom en el que se ve.
 */

const svg = (node) => renderToStaticMarkup(node);

// Iglesia ilustrada (torre con cúpula y cruz), en el estilo del logo.
const CHURCH_SVG = `
<svg viewBox="0 0 44 58" width="44" height="58" aria-hidden="true">
  <g stroke="#174936" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
    <path d="M22 2v9M18 6h8" fill="none"/>
    <path d="M13 21a9 9 0 0 1 18 0z" fill="#FBF6E9"/>
    <rect x="12" y="21" width="20" height="14" fill="#FBF6E9"/>
    <rect x="8" y="35" width="28" height="19" fill="#FBF6E9"/>
  </g>
  <g fill="#174936">
    <rect x="19" y="24" width="6" height="8" rx="3"/>
    <rect x="12" y="40" width="5" height="9" rx="2.5"/>
    <rect x="27" y="40" width="5" height="9" rx="2.5"/>
    <rect x="19.5" y="41" width="5" height="13" rx="2.5"/>
  </g>
</svg>`;

// Tamaño del ícono de la iglesia: completo desde CHURCH_FULL_ZOOM y de CHURCH_MIN_SCALE (proporción) a CHURCH_SMALL_ZOOM o menos.
const CHURCH_W = 44;
const CHURCH_H = 58;
const CHURCH_MIN_SCALE = 0.4;
const CHURCH_SMALL_ZOOM = 14.5;
const CHURCH_FULL_ZOOM = 17;

// Nombre del pueblo: tamaño de letra y altura sobre el mapa a TOWN_FULL_ZOOM; con menos zoom se achica (más lejos) y con más, crece.
const TOWN_FONT = 34;
const TOWN_HEIGHT = 60;
const TOWN_FULL_ZOOM = 15;
const TOWN_ZOOM_RATE = 0.85;
const TOWN_MIN_SCALE = 0.3;
const TOWN_MAX_SCALE = 1.5;

// Solo se muestran los sitios que hacen parte de la app: la iglesia y los parques.
// (Hoteles, estación de policía, estadio, etc. no se dibujan.)
function parkIconHtml() {
  return `<span class="lm-dot" style="background:#4E8A5B">${svg(<Trees size={14} color="#fff" strokeWidth={2.4} />)}</span>`;
}

function element(html, className) {
  const el = document.createElement('div');
  el.className = `lm ${className}`;
  el.innerHTML = html;
  return el;
}

const inside = ([lng, lat], pad = 0) =>
  lng > NEIRA_BOUNDS[0][0] - pad && lng < NEIRA_BOUNDS[1][0] + pad && lat > NEIRA_BOUNDS[0][1] - pad && lat < NEIRA_BOUNDS[1][1] + pad;

export async function addLandmarks(map) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const [pois, places] = await Promise.all([
    fetch(`${base}/map/pois.geojson`).then((r) => r.json()),
    fetch(`${base}/map/places.geojson`).then((r) => r.json()),
  ]);

  const items = []; // { marker, min, max }
  const add = (lngLat, el, { min = 0, max = 24, anchor = 'center', offset = [0, 0], onZoom }) => {
    const marker = new Marker({ element: el, anchor, offset }).setLngLat(lngLat).addTo(map);
    items.push({ el, min, max, onZoom });
    return marker;
  };

  // Sitios del pueblo
  for (const f of pois.features) {
    const { name, kind } = f.properties;
    const at = f.geometry.coordinates;
    if (!inside(at)) continue;
    if (kind === 'church') {
      const church = element(`${CHURCH_SVG}<span class="lm-label lm-church">${name ?? 'Iglesia'}</span>`, 'lm-church-wrap');
      const icon = church.querySelector('svg');
      add(at, church, {
        min: 14.5,
        anchor: 'bottom',
        // El ícono se achica al alejar el zoom: si no, a la vista general tapa las tiendas que tiene cerca.
        onZoom: (z) => {
          const scale = CHURCH_MIN_SCALE + (1 - CHURCH_MIN_SCALE) * Math.min(1, Math.max(0, (z - CHURCH_SMALL_ZOOM) / (CHURCH_FULL_ZOOM - CHURCH_SMALL_ZOOM)));
          icon.setAttribute('width', String(Math.round(CHURCH_W * scale)));
          icon.setAttribute('height', String(Math.round(CHURCH_H * scale)));
        },
      });
    } else if (kind === 'park' && name) {
      add(at, element(`${parkIconHtml()}<span class="lm-label">${name}</span>`, 'lm-poi'), { min: 15.5 });
    }
  }

  // Nombres de lugares: el pueblo, veredas y cerros
  const seen = new Set();
  for (const f of places.features) {
    const { name, place } = f.properties;
    const at = f.geometry.coordinates;
    if (!name || seen.has(name)) continue;
    if (place === 'town') {
      seen.add(name);
      // El nombre del pueblo está "escrito en el aire" sobre su posición del mapa, como los nombres de mapas de los juegos:
      // se queda en ese punto del mapa (no en la pantalla) y crece o se achica con la distancia, junto con el resto del mapa.
      const town = element(`<span class="lm-town">${name}</span>`, 'lm-town-wrap');
      const label = town.querySelector('.lm-town');
      const marker = add(at, town, { min: 0, max: 16.2, anchor: 'bottom', offset: [0, -TOWN_HEIGHT] });
      const last = items[items.length - 1];
      last.onZoom = (z) => {
        const scale = Math.min(TOWN_MAX_SCALE, Math.max(TOWN_MIN_SCALE, 2 ** ((z - TOWN_FULL_ZOOM) * TOWN_ZOOM_RATE)));
        label.style.fontSize = `${Math.round(TOWN_FONT * scale)}px`;
        marker.setOffset([0, -Math.round(TOWN_HEIGHT * scale)]); // la altura sobre el suelo también sigue la escala
      };
    } else if (place === 'peak' && inside(at)) {
      seen.add(name);
      add(at, element(`<span class="lm-peak">${svg(<Mountain size={14} strokeWidth={2.4} />)}<span>${name}</span></span>`, 'lm-peak-wrap'), { min: 14 });
    } else if (['locality', 'village', 'hamlet', 'farm'].includes(place) && inside(at, 0.004)) {
      seen.add(name);
      add(at, element(`<span class="lm-place">${name}</span>`, 'lm-place-wrap'), { min: 15, max: 18 });
    }
  }

  const refresh = () => {
    const z = map.getZoom();
    for (const { el, min, max, onZoom } of items) {
      el.style.display = z >= min && z <= max ? '' : 'none';
      onZoom?.(z);
    }
  };
  map.on('zoom', refresh);
  refresh();

  return () => {
    map.off('zoom', refresh);
    items.forEach(({ el }) => el.remove());
  };
}

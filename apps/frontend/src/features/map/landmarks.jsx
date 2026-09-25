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
  const add = (lngLat, el, { min = 0, max = 24, anchor = 'center', offset = [0, 0] }) => {
    const marker = new Marker({ element: el, anchor, offset }).setLngLat(lngLat).addTo(map);
    items.push({ el, min, max });
    return marker;
  };

  // Sitios del pueblo
  for (const f of pois.features) {
    const { name, kind } = f.properties;
    const at = f.geometry.coordinates;
    if (!inside(at)) continue;
    if (kind === 'church') {
      add(at, element(`${CHURCH_SVG}<span class="lm-label lm-church">${name ?? 'Iglesia'}</span>`, 'lm-church-wrap'), {
        min: 14.5,
        anchor: 'bottom',
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
      add(at, element(`<span class="lm-town">${name}</span>`, 'lm-town-wrap'), { min: 0, max: 16.2, anchor: 'bottom', offset: [0, -66] });
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
    for (const { el, min, max } of items) el.style.display = z >= min && z <= max ? '' : 'none';
  };
  map.on('zoom', refresh);
  refresh();

  return () => {
    map.off('zoom', refresh);
    items.forEach(({ el }) => el.remove());
  };
}

import { mapColors as c } from './tokens.js';

// Rectángulo de la vegetación pintada (ver scripts/build-vegetation.py).
export const VEGETATION_COORDS = [
  [-75.55, 5.2],
  [-75.49, 5.2],
  [-75.49, 5.14],
  [-75.55, 5.14],
];

const FONT_REGULAR = ['Noto Sans Regular'];
const FONT_ITALIC = ['Noto Sans Italic'];
const FONT_BOLD = ['Noto Sans Bold'];

const road = (id, cls, extra = {}) => ({
  id,
  type: 'line',
  source: 'roads',
  filter: ['all', ['==', ['get', 'cls'], cls], ...(extra.filter ?? [])],
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: extra.paint,
  minzoom: extra.minzoom,
});

/**
 * Edificios (casas de OpenStreetMap): planos desde el zoom 15 y en volumen suave desde el 16 (se ven en 3D
 * al inclinar el mapa). No van en el estilo base: se agregan solo cuando el usuario los quiere ver, así
 * en el celular no se descarga ni se dibuja el 1 MB de casas si están ocultas (ver setBuildings en NeiraMap).
 */
export const BUILDINGS_SOURCE_ID = 'buildings';
export const BUILDING_LAYER_IDS = ['buildings-flat', 'buildings-3d'];
export const buildingsSource = () => ({
  type: 'geojson',
  data: `${import.meta.env.BASE_URL.replace(/\/$/, '')}/map/buildings.geojson`,
});
export const buildingLayers = () => [
  {
    id: 'buildings-flat',
    type: 'fill',
    source: 'buildings',
    minzoom: 15,
    maxzoom: 16,
    paint: { 'fill-color': c.building, 'fill-outline-color': c.buildingEdge },
  },
  {
    id: 'buildings-3d',
    type: 'fill-extrusion',
    source: 'buildings',
    minzoom: 16,
    paint: {
      'fill-extrusion-color': [
        'case',
        ['==', ['get', 'kind'], 'church'], c.church,
        ['interpolate', ['linear'], ['get', 'height'], 5.5, '#C3BCA9', 8, '#B9B19D', 10, '#AEA692'],
      ],
      'fill-extrusion-height': ['*', ['get', 'height'], ['case', ['==', ['get', 'kind'], 'church'], 2.2, 1]],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.96,
      'fill-extrusion-vertical-gradient': false,
    },
  }
];

/**
 * Estilo propio del mapa de Neira. Sin teselas de terceros para las capas de diseño: los datos del pueblo
 * (calles, casas, agua, sitios) vienen de OpenStreetMap en public/map/*.geojson; la vegetación es una
 * ilustración derivada del relieve; el relieve y las curvas de nivel salen de la elevación Terrarium.
 *
 * `contourTiles` y `demTiles` son las URL de los protocolos de maplibre-contour (ver NeiraMap.jsx).
 */
export function buildStyle({ contourTiles, demTiles }) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const data = (name) => `${base}/map/${name}.geojson`;

  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      dem: { type: 'raster-dem', tiles: [demTiles], tileSize: 256, maxzoom: 13, encoding: 'terrarium' },
      contours: { type: 'vector', tiles: [contourTiles], maxzoom: 15 },
      vegetation: { type: 'image', url: `${base}/map/vegetation.webp`, coordinates: VEGETATION_COORDS },
      roads: { type: 'geojson', data: data('roads') },
      water: { type: 'geojson', data: data('water') },
      landcover: { type: 'geojson', data: data('landcover') },
      boundary: { type: 'geojson', data: data('boundary') },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': c.background } },

      // Naturaleza: pintura derivada del relieve y sombreado del terreno encima.
      { id: 'vegetation', type: 'raster', source: 'vegetation', paint: { 'raster-opacity': 0.92, 'raster-brightness-min': 0.1, 'raster-saturation': 0.3, 'raster-fade-duration': 0 } },
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'dem',
        paint: {
          'hillshade-exaggeration': 0.22,
          'hillshade-shadow-color': '#2F5D48',
          'hillshade-highlight-color': '#FBF8EC',
          'hillshade-accent-color': '#3E7A5C',
          'hillshade-illumination-direction': 315,
        },
      },

      // Curvas de nivel: finas, y más marcadas cada 100 m.
      {
        id: 'contour-minor',
        type: 'line',
        source: 'contours',
        'source-layer': 'contours',
        filter: ['!=', ['get', 'level'], 1],
        paint: {
          'line-color': c.contour,
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.12, 16, 0.28],
          'line-width': 0.6,
        },
      },
      {
        id: 'contour-major',
        type: 'line',
        source: 'contours',
        'source-layer': 'contours',
        filter: ['==', ['get', 'level'], 1],
        paint: { 'line-color': c.contour, 'line-opacity': 0.42, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.7, 17, 1.3] },
      },
      {
        id: 'contour-labels',
        type: 'symbol',
        source: 'contours',
        'source-layer': 'contours',
        filter: ['==', ['get', 'level'], 1],
        minzoom: 14.5,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['concat', ['number-format', ['get', 'ele'], {}], ' m'],
          'text-font': FONT_REGULAR,
          'text-size': 10,
        },
        paint: { 'text-color': '#3E7A5C', 'text-halo-color': c.halo, 'text-halo-width': 1.2, 'text-opacity': 0.85 },
      },

      // Cobertura de OpenStreetMap
      {
        id: 'landcover',
        type: 'fill',
        source: 'landcover',
        paint: {
          'fill-color': [
            'match', ['get', 'cls'],
            'park', c.park,
            'sport', c.sport,
            'cemetery', c.cemetery,
            'forest', '#6FA57F',
            'grass', '#D3E6C8',
            'farm', '#DCE8C6',
            c.park,
          ],
          'fill-opacity': 0.92,
        },
      },
      {
        id: 'landcover-edge',
        type: 'line',
        source: 'landcover',
        paint: { 'line-color': c.parkEdge, 'line-width': 1, 'line-opacity': 0.7 },
      },

      // Agua: cuerpo, borde claro y brillo central; ríos con ancho según el zoom.
      { id: 'water-area', type: 'fill', source: 'water', filter: ['==', ['get', 'geom'], 'area'], paint: { 'fill-color': c.water } },
      {
        id: 'water-area-edge',
        type: 'line',
        source: 'water',
        filter: ['==', ['get', 'geom'], 'area'],
        paint: { 'line-color': c.waterDeep, 'line-width': 1.2, 'line-opacity': 0.8 },
      },
      {
        id: 'river-casing',
        type: 'line',
        source: 'water',
        filter: ['all', ['==', ['get', 'geom'], 'line']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': c.waterDeep,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, ['match', ['get', 'cls'], 'river', 3, 1.4], 18, ['match', ['get', 'cls'], 'river', 20, 6]],
        },
      },
      {
        id: 'river',
        type: 'line',
        source: 'water',
        filter: ['all', ['==', ['get', 'geom'], 'line']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': c.water,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, ['match', ['get', 'cls'], 'river', 2, 0.8], 18, ['match', ['get', 'cls'], 'river', 16, 4]],
        },
      },
      {
        id: 'river-shine',
        type: 'line',
        source: 'water',
        minzoom: 15,
        filter: ['all', ['==', ['get', 'geom'], 'line'], ['==', ['get', 'cls'], 'river']],
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': c.waterLine, 'line-width': 2, 'line-opacity': 0.8, 'line-dasharray': [1, 3] },
      },

      // Límite del casco urbano: línea punteada verde.
      {
        id: 'boundary',
        type: 'line',
        source: 'boundary',
        layout: { 'line-join': 'round' },
        paint: { 'line-color': '#236B4A', 'line-width': 2, 'line-opacity': 0.7, 'line-dasharray': [2, 2.2] },
      },

      // Calles: contorno + relleno, de menor a mayor jerarquía.
      road('path', 'path', {
        minzoom: 15.5,
        paint: { 'line-color': c.path, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.8, 18, 2], 'line-dasharray': [2, 1.5], 'line-opacity': 0.9 },
      }),
      road('track', 'track', {
        minzoom: 14.5,
        paint: { 'line-color': '#C8B48A', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1, 18, 3], 'line-dasharray': [3, 1.5] },
      }),
      road('minor-casing', 'minor', {
        paint: { 'line-color': c.roadCasing, 'line-opacity': 0.92, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1.8, 16, 6.5, 19, 22] },
      }),
      road('minor', 'minor', {
        paint: { 'line-color': c.roadMinor, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.8, 16, 4, 19, 17] },
      }),
      road('medium-casing', 'medium', {
        paint: { 'line-color': c.roadMajorCasing, 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2.6, 16, 9, 19, 28] },
      }),
      road('medium', 'medium', {
        paint: { 'line-color': c.roadMedium, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1.2, 16, 6, 19, 22] },
      }),
      road('major-casing', 'major', {
        paint: { 'line-color': c.roadMajorCasing, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 3.4, 16, 11, 19, 32] },
      }),
      road('major', 'major', {
        paint: { 'line-color': c.roadMajor, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2, 16, 8, 19, 26] },
      }),

      // Calle Real: vía peatonal principal, en rojo de la marca con un trazo punteado claro al centro.
      {
        id: 'real-casing',
        type: 'line',
        source: 'roads',
        filter: ['==', ['get', 'cls'], 'real'],
        minzoom: 14,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.roadRealCasing, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 4, 16, 13, 19, 34] },
      },
      {
        id: 'real',
        type: 'line',
        source: 'roads',
        filter: ['==', ['get', 'cls'], 'real'],
        minzoom: 14,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.roadReal, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 2.4, 16, 9, 19, 26] },
      },
      {
        id: 'real-dash',
        type: 'line',
        source: 'roads',
        filter: ['==', ['get', 'cls'], 'real'],
        minzoom: 16,
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: { 'line-color': '#F8F5ED', 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 16, 1.2, 19, 3], 'line-dasharray': [1.6, 2.2] },
      },

      // Rótulos de calles y ríos
      {
        id: 'road-labels',
        type: 'symbol',
        source: 'roads',
        minzoom: 16,
        filter: ['all', ['has', 'name'], ['!=', ['get', 'cls'], 'path'], ['!=', ['get', 'cls'], 'real']],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': FONT_REGULAR,
          'text-size': ['interpolate', ['linear'], ['zoom'], 16, 10, 19, 13],
          'text-letter-spacing': 0.04,
          'text-max-angle': 35,
        },
        paint: { 'text-color': c.roadLabel, 'text-halo-color': c.roadLabelHalo, 'text-halo-width': 1.3 },
      },
      {
        id: 'real-labels',
        type: 'symbol',
        source: 'roads',
        minzoom: 15.5,
        filter: ['==', ['get', 'cls'], 'real'],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': FONT_BOLD,
          'text-size': ['interpolate', ['linear'], ['zoom'], 15.5, 11, 19, 14],
          'text-letter-spacing': 0.06,
          'text-max-angle': 35,
        },
        paint: { 'text-color': c.roadLabel, 'text-halo-color': c.roadRealLabelHalo, 'text-halo-width': 1.6 },
      },
      {
        id: 'river-labels',
        type: 'symbol',
        source: 'water',
        minzoom: 14,
        filter: ['all', ['==', ['get', 'geom'], 'line'], ['has', 'name']],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': FONT_ITALIC,
          'text-size': 12,
          'text-letter-spacing': 0.12,
        },
        paint: { 'text-color': c.labelWater, 'text-halo-color': c.halo, 'text-halo-width': 1.6 },
      },
    ],
  };
}

export { FONT_BOLD };

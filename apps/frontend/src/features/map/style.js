import { mapColors, mapColorsNight } from './tokens.js';

const paletteFor = (theme) => (theme === 'night' ? mapColorsNight : mapColors);

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

/**
 * Textura de copas de árbol para los parques (ver NeiraMap `map.addImage`): en vez de un verde plano,
 * el relleno usa este mosaico como `fill-pattern`. Se dibuja con Canvas 2D en vez de traer un PNG porque
 * son solo unos círculos, igual que el resto de los adornos de la app (hojas, etc.).
 */
export const PARK_PATTERN_ID = 'park-trees-pattern';
export function createParkPatternImage(theme = 'day') {
  const c = paletteFor(theme);
  // Un mosaico grande y con tamaños/posiciones al azar (en vez de pocos círculos iguales espaciados
  // parejo) para que no se note la repetición ni parezca una cuadrícula de puntos.
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const forestGreen = c.forest;
  const darkGreen = theme === 'night' ? '#0D1E12' : '#5C8F6C';

  // Aleatorio con semilla fija: el mosaico sale igual siempre (no cambia en cada carga del mapa) pero
  // sin la regularidad de una cuadrícula.
  let seed = 11;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const blobs = Array.from({ length: 34 }, () => ({
    x: rand() * size,
    y: rand() * size,
    r: 1.4 + rand() * rand() * 4.5, // más chicos que grandes: unos pocos destacan, la mayoría son puntas pequeñas
    fill: [forestGreen, darkGreen, c.parkEdge][Math.floor(rand() * 3)],
    alpha: 0.28 + rand() * 0.4,
  }));

  const draw = (x, y, r, fill, alpha) => {
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = 'rgba(40, 70, 50, .8)';
    ctx.beginPath();
    ctx.arc(x + 0.7, y + 1, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // Cada copa se dibuja también corrida ±`size` para que, al repetirse el mosaico, ninguna quede
  // cortada a la mitad justo en el borde (lo que se vería como una costura).
  blobs.forEach(({ x, y, r, fill, alpha }) => {
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        if (Math.abs(x + dx - size / 2) < size && Math.abs(y + dy - size / 2) < size) {
          draw(x + dx, y + dy, r, fill, alpha);
        }
      }
    }
  });
  ctx.globalAlpha = 1;

  // `map.addImage` no acepta un <canvas> directamente (solo ImageData, ImageBitmap o HTMLImageElement).
  return ctx.getImageData(0, 0, size, size);
}

/**
 * "Luces de casas" vistas desde el cielo, de noche: un mosaico de lucecitas cálidas y tenues que se pinta
 * como `fill-pattern` de la capa `city-lights`, recortado al polígono del casco urbano (fuente `boundary`)
 * para que solo aparezcan en el pueblo y no en el campo de alrededor. El agua y los parques del pueblo se
 * pintan opacos encima, así que tampoco se ven luces flotando sobre ellos.
 *
 * El mosaico trae su propio fondo oscuro pintado (no queda transparente): un `fill-pattern` reemplaza por
 * completo el color de la capa, así que si el mosaico tuviera huecos transparentes se vería el fondo claro
 * de la tarjeta del mapa por CSS (`.map-card`) en vez del verde oscuro nocturno.
 */
export const CITY_LIGHTS_PATTERN_ID = 'city-lights-pattern';
export function createCityLightsImage() {
  const size = 200;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = mapColorsNight.background;
  ctx.fillRect(0, 0, size, size);

  let seed = 29;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const shades = ['#FFE9B8', '#FFD98C', '#FFF3D6', '#FFC56B'];
  const lights = Array.from({ length: 110 }, () => ({
    x: rand() * size,
    y: rand() * size,
    r: 0.6 + rand() * rand() * 2,
    fill: shades[Math.floor(rand() * shades.length)],
    alpha: 0.3 + rand() * 0.5,
  }));

  const draw = (x, y, r, fill, alpha) => {
    // Resplandor suave alrededor del punto: como una lucecita vista desde muy arriba, no un puntico seco.
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
    glow.addColorStop(0, fill);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha * 0.45;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  lights.forEach(({ x, y, r, fill, alpha }) => {
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        if (Math.abs(x + dx - size / 2) < size && Math.abs(y + dy - size / 2) < size) {
          draw(x + dx, y + dy, r, fill, alpha);
        }
      }
    }
  });
  ctx.globalAlpha = 1;
  return ctx.getImageData(0, 0, size, size);
}

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
export const buildingLayers = (theme = 'day') => {
  const c = paletteFor(theme);
  const roofShades = theme === 'night' ? ['#2E362E', '#363F36', '#3D463D'] : ['#C3BCA9', '#B9B19D', '#AEA692'];
  return [
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
        ['interpolate', ['linear'], ['get', 'height'], 5.5, roofShades[0], 8, roofShades[1], 10, roofShades[2]],
      ],
      'fill-extrusion-height': ['*', ['get', 'height'], ['case', ['==', ['get', 'kind'], 'church'], 2.2, 1]],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.96,
      'fill-extrusion-vertical-gradient': false,
    },
  }
  ];
};

/**
 * Estilo propio del mapa de Neira. Sin teselas de terceros para las capas de diseño: los datos del pueblo
 * (calles, casas, agua, sitios) vienen de OpenStreetMap en public/map/*.geojson; la vegetación es una
 * ilustración derivada del relieve; el relieve y las curvas de nivel salen de la elevación Terrarium.
 *
 * `contourTiles` y `demTiles` son las URL de los protocolos de maplibre-contour (ver NeiraMap.jsx).
 * `theme` ('day' | 'night') fija los colores iniciales; para cambiarlo después sin recargar el mapa
 * (perdiendo el relieve 3D y los edificios) se usa `applyMapTheme`, más abajo.
 */
export function buildStyle({ contourTiles, demTiles }, theme = 'day') {
  const c = paletteFor(theme);
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

      // Naturaleza: pintura derivada del relieve y sombreado del terreno encima. De noche se atenúa con
      // opacidad (no con `raster-brightness-max`: bajarlo no oscurece, "recorta" a blanco puro cualquier
      // parte de la ilustración que ya tuviera algo de brillo, y eso se veía como parches blancos).
      {
        id: 'vegetation',
        type: 'raster',
        source: 'vegetation',
        paint: {
          'raster-opacity': theme === 'night' ? 0.32 : 0.92,
          'raster-brightness-min': 0.1,
          'raster-saturation': theme === 'night' ? -0.6 : 0.3,
          'raster-fade-duration': 0,
        },
      },
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'dem',
        paint: {
          'hillshade-exaggeration': 0.22,
          'hillshade-shadow-color': theme === 'night' ? '#050C08' : '#2F5D48',
          'hillshade-highlight-color': theme === 'night' ? '#26362B' : '#FBF8EC',
          'hillshade-accent-color': theme === 'night' ? '#1B3323' : '#3E7A5C',
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
        paint: { 'text-color': theme === 'night' ? '#8FBFA0' : '#3E7A5C', 'text-halo-color': c.halo, 'text-halo-width': 1.2, 'text-opacity': 0.85 },
      },

      // "Luces de casas" de noche (ver `createCityLightsImage`): en vez de cubrir todo el mapa, el mosaico
      // se recorta con el polígono del casco urbano (`boundary`, el mismo que dibuja el límite punteado),
      // así las lucecitas quedan solo en el pueblo y no se riegan por el campo alrededor. De día es
      // invisible (`fill-opacity: 0`); el agua y los parques del pueblo (más abajo) igual se pintan
      // opacos encima, así que las luces no se ven flotando sobre ellos.
      {
        id: 'city-lights',
        type: 'fill',
        source: 'boundary',
        paint: { 'fill-pattern': CITY_LIGHTS_PATTERN_ID, 'fill-opacity': theme === 'night' ? 1 : 0 },
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
            'forest', c.forest,
            'grass', c.grass,
            'farm', c.farm,
            c.park,
          ],
          'fill-opacity': 0.92,
        },
      },
      // Textura de copas de árbol sobre los parques (ver `createParkPatternImage`, cargada en NeiraMap).
      // A poco zoom se vería como ruido, así que solo aparece al acercarse.
      {
        id: 'landcover-park-texture',
        type: 'fill',
        source: 'landcover',
        filter: ['==', ['get', 'cls'], 'park'],
        minzoom: 14,
        paint: { 'fill-pattern': PARK_PATTERN_ID, 'fill-opacity': 0.9 },
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
        paint: { 'line-color': c.boundary, 'line-width': 2, 'line-opacity': 0.7, 'line-dasharray': [2, 2.2] },
      },

      // Calles: contorno + relleno, de menor a mayor jerarquía.
      road('path', 'path', {
        minzoom: 15.5,
        paint: { 'line-color': c.path, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.8, 18, 2], 'line-dasharray': [2, 1.5], 'line-opacity': 0.9 },
      }),
      road('track', 'track', {
        minzoom: 14.5,
        paint: { 'line-color': c.track, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1, 18, 3], 'line-dasharray': [3, 1.5] },
      }),
      // Resplandor cálido bajo las vías principales: de día es transparente (`c.roadGlow`); de noche
      // simula el alumbrado público con un trazo ancho y difuminado debajo de la calle.
      road('major-glow', 'major', {
        paint: { 'line-color': c.roadGlow, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 6, 16, 18, 19, 42], 'line-blur': 5 },
      }),
      road('minor-casing', 'minor', {
        paint: { 'line-color': c.roadCasing, 'line-opacity': 0.92, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1.8, 16, 6.5, 19, 22] },
      }),
      road('minor', 'minor', {
        paint: { 'line-color': c.roadMinor, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.8, 16, 4, 19, 17] },
      }),
      road('medium-glow', 'medium', {
        paint: { 'line-color': c.roadGlow, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 4, 16, 12, 19, 30], 'line-blur': 4 },
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
        id: 'real-glow',
        type: 'line',
        source: 'roads',
        filter: ['==', ['get', 'cls'], 'real'],
        minzoom: 14,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': c.roadGlow, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 10, 16, 26, 19, 56], 'line-blur': 6 },
      },
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
        paint: { 'line-color': c.roadRealDash, 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 16, 1.2, 19, 3], 'line-dasharray': [1.6, 2.2] },
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

/**
 * Cambia de tema sin recargar el mapa: a diferencia de `map.setStyle(buildStyle(...))`, esto no reinicia
 * las fuentes (perdería el relieve 3D activo, los edificios ya cargados y forzaría a recalcular el
 * terreno), solo actualiza los colores de las capas que ya existen con `setPaintProperty`.
 */
export function applyMapTheme(map, theme) {
  const c = paletteFor(theme);
  const set = (layer, prop, value) => {
    if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value);
  };

  set('background', 'background-color', c.background);
  set('city-lights', 'fill-opacity', theme === 'night' ? 1 : 0);
  set('vegetation', 'raster-opacity', theme === 'night' ? 0.32 : 0.92);
  set('vegetation', 'raster-saturation', theme === 'night' ? -0.6 : 0.3);
  set('hillshade', 'hillshade-shadow-color', theme === 'night' ? '#050C08' : '#2F5D48');
  set('hillshade', 'hillshade-highlight-color', theme === 'night' ? '#26362B' : '#FBF8EC');
  set('hillshade', 'hillshade-accent-color', theme === 'night' ? '#1B3323' : '#3E7A5C');
  set('contour-minor', 'line-color', c.contour);
  set('contour-major', 'line-color', c.contour);
  set('contour-labels', 'text-color', theme === 'night' ? '#8FBFA0' : '#3E7A5C');
  set('contour-labels', 'text-halo-color', c.halo);
  set('landcover', 'fill-color', [
    'match', ['get', 'cls'],
    'park', c.park,
    'sport', c.sport,
    'cemetery', c.cemetery,
    'forest', c.forest,
    'grass', c.grass,
    'farm', c.farm,
    c.park,
  ]);
  set('landcover-edge', 'line-color', c.parkEdge);
  set('water-area', 'fill-color', c.water);
  set('water-area-edge', 'line-color', c.waterDeep);
  set('river-casing', 'line-color', c.waterDeep);
  set('river', 'line-color', c.water);
  set('river-shine', 'line-color', c.waterLine);
  set('boundary', 'line-color', c.boundary);
  set('path', 'line-color', c.path);
  set('track', 'line-color', c.track);
  set('major-glow', 'line-color', c.roadGlow);
  set('medium-glow', 'line-color', c.roadGlow);
  set('minor-casing', 'line-color', c.roadCasing);
  set('minor', 'line-color', c.roadMinor);
  set('medium-casing', 'line-color', c.roadMajorCasing);
  set('medium', 'line-color', c.roadMedium);
  set('major-casing', 'line-color', c.roadMajorCasing);
  set('major', 'line-color', c.roadMajor);
  set('real-glow', 'line-color', c.roadGlow);
  set('real-casing', 'line-color', c.roadRealCasing);
  set('real', 'line-color', c.roadReal);
  set('real-dash', 'line-color', c.roadRealDash);
  set('road-labels', 'text-color', c.roadLabel);
  set('road-labels', 'text-halo-color', c.roadLabelHalo);
  set('real-labels', 'text-color', c.roadLabel);
  set('real-labels', 'text-halo-color', c.roadRealLabelHalo);
  set('river-labels', 'text-color', c.labelWater);
  set('river-labels', 'text-halo-color', c.halo);

  // Los edificios solo existen si el usuario los activó (ver setBuildings en NeiraMap).
  const roofShades = theme === 'night' ? ['#2E362E', '#363F36', '#3D463D'] : ['#C3BCA9', '#B9B19D', '#AEA692'];
  set('buildings-flat', 'fill-color', c.building);
  set('buildings-flat', 'fill-outline-color', c.buildingEdge);
  set('buildings-3d', 'fill-extrusion-color', [
    'case',
    ['==', ['get', 'kind'], 'church'], c.church,
    ['interpolate', ['linear'], ['get', 'height'], 5.5, roofShades[0], 8, roofShades[1], 10, roofShades[2]],
  ]);
}

export { FONT_BOLD };

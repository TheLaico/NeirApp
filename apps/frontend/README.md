# NeirAPP · frontend

React + Vite. `npm install` y `npm run dev` (http://localhost:5173). El proxy de `/api` apunta al backend en `localhost:8000`.

## Mapa de Neira

El mapa (MapLibre) se dibuja con un estilo propio, sin teselas de terceros para el diseño:

| Capa | Origen |
|---|---|
| Calles, casas, agua, parques, sitios y nombres | OpenStreetMap → `public/map/*.geojson` |
| Relieve y curvas de nivel | Elevación Terrarium (Mapzen / NASA SRTM), calculada en el navegador |
| Vegetación (bosque, cafetales, pasto) | Ilustración **decorativa** derivada del relieve → `public/map/vegetation.webp` |
| Nombres y sitios con la tipografía de la marca | Marcadores HTML (`src/features/map/landmarks.jsx`) |

Para regenerar los datos (necesita Python 3 con `numpy` y `Pillow`):

```bash
python scripts/build-map-data.py     # descarga de OpenStreetMap (Overpass) y crea los GeoJSON
python scripts/build-vegetation.py   # crea la ilustración de vegetación desde la elevación
```

Los datos de mapa son © colaboradores de OpenStreetMap (ODbL); el crédito se muestra en el mapa.
La vegetación no es un inventario real de cultivos ni de bosques.

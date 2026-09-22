import "maplibre-gl/dist/maplibre-gl.css";
import { colors, mapColors } from "@neirapp/design-tokens";
import {
  Marker,
  MapLibreMap,
  NavigationControl,
  type LngLatBoundsLike,
  type MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { categoryColor, StoreIcon } from "../stores/StoreIcon";
import type { StoreDto } from "../stores/types";

// Coincide (con un pequeño margen) con NEIRA_POLYGON en apps/api .../stores/domain/geofence.py.
// Ver ese archivo para la nota sobre por qué es un placeholder aproximado.
export const NEIRA_BOUNDS: LngLatBoundsLike = [
  [-75.575, 5.125],
  [-75.465, 5.205],
];
export const NEIRA_CENTER: [number, number] = [-75.52, 5.165];

/**
 * Estilo vectorial propio, sin tiles externos: solo un fondo y un par de formas ilustrativas
 * (vegetación, río) en los tonos de la identidad visual. No depende de internet ni de datos
 * geográficos reales — es una textura, no un mapa preciso (ver roadmap: PMTiles de Neira reales).
 */
function buildStyle() {
  return {
    version: 8 as const,
    sources: {
      vegetation: {
        type: "geojson" as const,
        data: {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "Polygon" as const,
                coordinates: [
                  [
                    [-75.575, 5.2],
                    [-75.5, 5.207],
                    [-75.468, 5.185],
                    [-75.49, 5.15],
                    [-75.55, 5.155],
                    [-75.575, 5.2],
                  ],
                ],
              },
            },
          ],
        },
      },
      river: {
        type: "geojson" as const,
        data: {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "LineString" as const,
                coordinates: [
                  [-75.552, 5.203],
                  [-75.545, 5.19],
                  [-75.549, 5.175],
                  [-75.538, 5.158],
                  [-75.543, 5.14],
                  [-75.533, 5.126],
                ],
              },
            },
          ],
        },
      },
    },
    layers: [
      { id: "background", type: "background" as const, paint: { "background-color": mapColors.background } },
      {
        id: "vegetation",
        type: "fill" as const,
        source: "vegetation",
        paint: { "fill-color": mapColors.vegetation, "fill-opacity": 0.85 },
      },
      {
        id: "river",
        type: "line" as const,
        source: "river",
        paint: { "line-color": mapColors.water, "line-width": 9, "line-opacity": 0.9 },
      },
    ],
  };
}

function markerElement(store: StoreDto): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cursor = "pointer";
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", store.name);
  el.innerHTML = renderToStaticMarkup(
    <span
      style={{
        display: "grid",
        placeItems: "center",
        width: 36,
        height: 36,
        borderRadius: 9999,
        border: "2px solid white",
        boxShadow: "0 1px 3px rgba(32,39,36,.25)",
        backgroundColor: categoryColor(store.category),
        opacity: store.is_open ? 1 : 0.5,
      }}
    >
      <StoreIcon category={store.category} size={18} />
    </span>,
  );
  return el;
}

export interface NeiraMapProps {
  stores: StoreDto[];
  onSelectStore?: (store: StoreDto) => void;
  /** Modo "elegir ubicación": el mapa escucha clics y muestra un marcador en el punto elegido. */
  pickMode?: boolean;
  pickedLocation?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number) => void;
  className?: string;
}

export function NeiraMap({
  stores,
  onSelectStore,
  pickMode = false,
  pickedLocation,
  onPick,
  className = "",
}: NeiraMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const pickMarkerRef = useRef<Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: buildStyle(),
      center: NEIRA_CENTER,
      zoom: 13,
      minZoom: 12,
      maxZoom: 18,
      maxBounds: NEIRA_BOUNDS,
      attributionControl: false,
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = stores.map((store) => {
      const marker = new Marker({ element: markerElement(store) })
        .setLngLat([store.lng, store.lat])
        .addTo(map);
      marker.getElement().addEventListener("click", () => onSelectStore?.(store));
      return marker;
    });
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [stores, onSelectStore]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pickMode) return;
    const handleClick = (e: MapMouseEvent) => onPick?.(e.lngLat.lat, e.lngLat.lng);
    map.on("click", handleClick);
    map.getCanvas().style.cursor = "crosshair";
    return () => {
      map.off("click", handleClick);
      map.getCanvas().style.cursor = "";
    };
  }, [pickMode, onPick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pickedLocation) {
      const lngLat: [number, number] = [pickedLocation.lng, pickedLocation.lat];
      if (pickMarkerRef.current) {
        pickMarkerRef.current.setLngLat(lngLat);
      } else {
        pickMarkerRef.current = new Marker({ color: colors.terracotta }).setLngLat(lngLat).addTo(map);
      }
    } else {
      pickMarkerRef.current?.remove();
      pickMarkerRef.current = null;
    }
  }, [pickedLocation]);

  return <div ref={containerRef} className={className} role="application" aria-label="Mapa de Neira" />;
}

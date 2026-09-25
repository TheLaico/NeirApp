#!/usr/bin/env python3
"""Genera los GeoJSON del mapa de Neira (Caldas) a partir de OpenStreetMap.

Uso:
    python scripts/build-map-data.py            # descarga de Overpass y convierte
    python scripts/build-map-data.py --raw f.json   # convierte un JSON de Overpass ya descargado

Salida: public/map/*.geojson (caminos, edificios, agua, cobertura, sitios, lugares y límite).
Datos © colaboradores de OpenStreetMap (ODbL).
"""
import argparse
import hashlib
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "map"

# Zona de trabajo: el casco urbano de Neira y sus alrededores inmediatos.
S, W, N, E = 5.145, -75.545, 5.195, -75.495
BBOX = f"{S},{W},{N},{E}"
TOWN = "5.150,-75.535,5.185,-75.505"  # edificios solo en el pueblo

QUERY = f"""
[out:json][timeout:120];
(
  way["highway"]({BBOX});
  way["building"]({TOWN});
  way["waterway"]({BBOX});
  way["natural"="water"]({BBOX});
  relation["natural"="water"]({BBOX});
  way["landuse"]({BBOX});
  relation["landuse"]({BBOX});
  way["natural"~"wood|scrub|grassland|wetland|bare_rock"]({BBOX});
  way["leisure"]({BBOX});
  way["amenity"]({TOWN});
  node["amenity"]({TOWN});
  node["shop"]({TOWN});
  node["tourism"]({BBOX});
  node["historic"]({BBOX});
  way["tourism"]({BBOX});
  node["place"](5.10,-75.60,5.24,-75.44);
  node["natural"="peak"](5.10,-75.60,5.24,-75.44);
);
out body geom;
"""

MIRRORS = [
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def download():
    data = urllib.parse.urlencode({"data": QUERY}).encode()
    for url in MIRRORS:
        for attempt in range(2):
            try:
                print(f"Descargando de {url} (intento {attempt + 1})…", file=sys.stderr)
                req = urllib.request.Request(url, data=data, headers={"User-Agent": "neirapp-dev/1.0"})
                with urllib.request.urlopen(req, timeout=180) as r:
                    return json.loads(r.read())
            except Exception as exc:  # noqa: BLE001
                print(f"  falló: {exc}", file=sys.stderr)
                time.sleep(3)
    sys.exit("No se pudo descargar de ningún servidor Overpass.")


def r6(v):
    return round(v, 6)


def coords(geom):
    return [[r6(p["lon"]), r6(p["lat"])] for p in geom]


def feature(geometry, **props):
    return {"type": "Feature", "properties": {k: v for k, v in props.items() if v is not None}, "geometry": geometry}


def collection(features):
    return {"type": "FeatureCollection", "features": features}


def is_closed(c):
    return len(c) >= 4 and c[0] == c[-1]


def centroid(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return [r6(sum(xs) / len(xs)), r6(sum(ys) / len(ys))]


def chain_rings(ways):
    """Une los tramos de un multipolígono en anillos cerrados."""
    ways = [w[:] for w in ways if len(w) > 1]
    rings = []
    while ways:
        ring = ways.pop(0)
        changed = True
        while changed and not is_closed(ring):
            changed = False
            for i, w in enumerate(ways):
                if w[0] == ring[-1]:
                    ring += w[1:]
                elif w[-1] == ring[-1]:
                    ring += w[::-1][1:]
                elif w[-1] == ring[0]:
                    ring = w[:-1] + ring
                elif w[0] == ring[0]:
                    ring = w[::-1][:-1] + ring
                else:
                    continue
                ways.pop(i)
                changed = True
                break
        if is_closed(ring):
            rings.append(ring)
    return rings


def polygon_geometry(el):
    """Geometría de un way cerrado o de una relación multipolígono."""
    if el["type"] == "way":
        c = coords(el["geometry"])
        return {"type": "Polygon", "coordinates": [c]} if is_closed(c) else None
    outers = [coords(m["geometry"]) for m in el.get("members", []) if m.get("role") == "outer" and "geometry" in m]
    rings = chain_rings(outers)
    if not rings:
        return None
    return {"type": "MultiPolygon", "coordinates": [[r] for r in rings]}


ROAD_CLASS = {
    "motorway": "major", "trunk": "major", "primary": "major", "motorway_link": "major",
    "trunk_link": "major", "primary_link": "major",
    "secondary": "medium", "tertiary": "medium", "secondary_link": "medium", "tertiary_link": "medium",
    "residential": "minor", "unclassified": "minor", "living_street": "minor", "service": "minor",
    "track": "track", "path": "path", "footway": "path", "steps": "path", "pedestrian": "path",
    "cycleway": "path", "bridleway": "path",
}


def land_class(tags):
    lu = tags.get("landuse")
    nat = tags.get("natural")
    leis = tags.get("leisure")
    if tags.get("crop") == "coffee" or tags.get("produce") == "coffee":
        return "coffee"
    if lu in ("forest",) or nat == "wood":
        return "forest"
    if nat == "scrub":
        return "scrub"
    if nat == "wetland":
        return "wetland"
    if nat == "bare_rock":
        return "rock"
    if lu in ("grass", "meadow", "village_green", "greenfield", "grazing") or nat == "grassland":
        return "grass"
    if lu in ("farmland", "orchard", "plant_nursery", "vineyard", "farmyard", "greenhouse_horticulture", "allotments"):
        return "farm"
    if leis in ("park", "garden", "playground", "nature_reserve", "recreation_ground", "common"):
        return "park"
    if leis in ("pitch", "sports_centre", "stadium", "track"):
        return "sport"
    if lu == "cemetery":
        return "cemetery"
    if lu in ("residential",):
        return "residential"
    if lu in ("commercial", "retail", "industrial", "institutional", "education", "religious", "civic"):
        return "urban"
    if lu in ("reservoir", "basin"):
        return None  # va a la capa de agua
    return None


POI_KIND = {
    "place_of_worship": "church", "school": "school", "college": "school", "kindergarten": "school",
    "hospital": "hospital", "clinic": "hospital", "pharmacy": "pharmacy", "townhall": "townhall",
    "marketplace": "market", "police": "police", "fire_station": "fire", "bank": "bank",
    "library": "library", "restaurant": "food", "cafe": "cafe", "fast_food": "food", "bakery": "food",
    "bar": "food", "fuel": "fuel", "community_centre": "townhall", "theatre": "culture",
}


def poi_kind(tags):
    a = tags.get("amenity")
    if a in POI_KIND:
        return POI_KIND[a]
    if tags.get("shop") in ("bakery",):
        return "food"
    if tags.get("shop") == "supermarket" or tags.get("shop") == "convenience":
        return "shop"
    if tags.get("tourism") in ("viewpoint", "attraction", "museum", "artwork", "hotel", "hostel", "guest_house"):
        return "tourism"
    if tags.get("historic"):
        return "historic"
    return None


def height_of(tags, ident):
    """Altura estimada del edificio (m), con una leve variación para que no se vea uniforme."""
    if "height" in tags:
        try:
            return float(str(tags["height"]).split()[0])
        except ValueError:
            pass
    if "building:levels" in tags:
        try:
            return float(tags["building:levels"]) * 3.2
        except ValueError:
            pass
    h = int(hashlib.md5(str(ident).encode()).hexdigest()[:4], 16) / 65535
    return round(5.5 + h * 4.5, 1)  # 5.5 - 10 m


def convert(raw):
    roads, buildings, water, land, pois, places = [], [], [], [], [], []
    for el in raw["elements"]:
        tags = el.get("tags", {})
        name = tags.get("name")
        et = el["type"]

        if et == "node":
            pt = {"type": "Point", "coordinates": [r6(el["lon"]), r6(el["lat"])]}
            if "place" in tags and name:
                places.append(feature(pt, name=name, place=tags["place"]))
            elif tags.get("natural") == "peak" and name:
                places.append(feature(pt, name=name, place="peak", ele=tags.get("ele")))
            else:
                kind = poi_kind(tags)
                if kind:
                    pois.append(feature(pt, name=name, kind=kind))
            continue

        if "geometry" not in el and et == "way":
            continue

        if "highway" in tags and et == "way":
            cls = ROAD_CLASS.get(tags["highway"])
            if cls is None:
                continue
            if name == "Calle Real":
                cls = "real"  # calle peatonal principal del pueblo: se resalta en el mapa
            roads.append(
                feature(
                    {"type": "LineString", "coordinates": coords(el["geometry"])},
                    cls=cls, kind=tags["highway"], name=name,
                    bridge=1 if tags.get("bridge") in ("yes", "viaduct") else None,
                    tunnel=1 if tags.get("tunnel") in ("yes", "culvert") else None,
                )
            )
            continue

        if "waterway" in tags and et == "way":
            if tags["waterway"] in ("river", "stream", "canal", "drain", "ditch", "brook"):
                water.append(
                    feature(
                        {"type": "LineString", "coordinates": coords(el["geometry"])},
                        geom="line", cls="river" if tags["waterway"] == "river" else "stream", name=name,
                    )
                )
            elif tags["waterway"] == "riverbank":
                g = polygon_geometry(el)
                if g:
                    water.append(feature(g, geom="area", name=name))
            continue

        if tags.get("natural") == "water" or tags.get("landuse") in ("reservoir", "basin"):
            g = polygon_geometry(el)
            if g:
                water.append(feature(g, geom="area", name=name))
            continue

        if "building" in tags and et == "way":
            g = polygon_geometry(el)
            if not g:
                continue
            kind = "church" if (tags["building"] in ("church", "cathedral", "chapel") or tags.get("amenity") == "place_of_worship") else "house"
            buildings.append(feature(g, kind=kind, name=name, height=height_of(tags, el["id"])))
            if kind == "church" or name:
                ring = g["coordinates"][0]
                pois.append(feature({"type": "Point", "coordinates": centroid(ring)}, name=name, kind="church" if kind == "church" else (poi_kind(tags) or "building"), from_building=1))
            continue

        cls = land_class(tags)
        if cls:
            g = polygon_geometry(el)
            if g:
                land.append(feature(g, cls=cls, name=name))
                if cls in ("park", "sport") and name and g["type"] == "Polygon":
                    pois.append(feature({"type": "Point", "coordinates": centroid(g["coordinates"][0])}, name=name, kind=cls))
            continue

        # amenity/tourism como área (colegio, hospital…): se guarda como sitio
        kind = poi_kind(tags)
        if kind and et == "way":
            c = coords(el["geometry"])
            if is_closed(c):
                pois.append(feature({"type": "Point", "coordinates": centroid(c)}, name=name, kind=kind))

    # sitios: solo la iglesia y los parques hacen parte de la app
    pois = [p for p in pois if p["properties"].get("kind") in ("church", "park")]
    return roads, buildings, water, land, pois, places


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw")
    args = ap.parse_args()

    raw = json.loads(Path(args.raw).read_text(encoding="utf-8")) if args.raw else download()
    roads, buildings, water, land, pois, places = convert(raw)

    OUT.mkdir(parents=True, exist_ok=True)
    files = {"roads": roads, "buildings": buildings, "water": water, "landcover": land, "pois": pois, "places": places}
    for name, feats in files.items():
        path = OUT / f"{name}.geojson"
        path.write_text(json.dumps(collection(feats), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{name:10s} {len(feats):6d} elementos  {path.stat().st_size / 1024:8.1f} KB")


if __name__ == "__main__":
    main()

"""Ruta sugerida para un repartidor: varias recogidas y una entrega final.

Sin GPS en vivo del repartidor (no hay tracking de ubicación en esta fase), "la ruta óptima" real
no se puede calcular — no sabemos desde dónde arranca. Esto es una heurística de vecino más cercano
(greedy): arranca en la primera parada tal como llega, visita las demás por cercanía y termina en
la dirección de entrega. No resuelve el TSP de forma óptima (es NP-difícil) pero para las pocas
paradas de un pedido típico da una ruta razonable. Reemplazar por un motor real (OSRM, Valhalla)
es la evolución natural — ver el roadmap original en docs/ARCHITECTURE.md.
"""

import math
from uuid import UUID


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r_km = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d_p = math.radians(lat2 - lat1)
    d_l = math.radians(lng2 - lng1)
    a = math.sin(d_p / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(d_l / 2) ** 2
    return 2 * r_km * math.asin(math.sqrt(a))


def suggest_route(
    stops: list[tuple[UUID, float, float]], delivery_lat: float, delivery_lng: float
) -> list[UUID]:
    """`stops`: (id, lat, lng) de cada recogida. Devuelve los ids en el orden sugerido de visita."""
    if not stops:
        return []
    remaining = list(stops)
    route = [remaining.pop(0)]
    while remaining:
        last_lat, last_lng = route[-1][1], route[-1][2]
        nearest = min(remaining, key=lambda s: _haversine_km(last_lat, last_lng, s[1], s[2]))
        remaining.remove(nearest)
        route.append(nearest)
    return [stop_id for stop_id, _, _ in route]

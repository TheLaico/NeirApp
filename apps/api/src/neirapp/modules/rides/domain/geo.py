from math import asin, cos, radians, sin, sqrt

# Lo que abarca el mapa de Neira de la app (el pueblo y sus alrededores inmediatos).
LAT_RANGE = (5.1485, 5.1865)
LNG_RANGE = (-75.5445, -75.4985)
# Un motocarro por las calles del pueblo (con lomas y curvas) va a unos 18 km/h de promedio.
AVERAGE_KMH = 18.0
# Las calles no van en línea recta: la distancia real es más o menos un 35 % mayor.
ROAD_FACTOR = 1.35


def in_neira(lat: float, lng: float) -> bool:
    return LAT_RANGE[0] <= lat <= LAT_RANGE[1] and LNG_RANGE[0] <= lng <= LNG_RANGE[1]


def distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia en línea recta (haversine)."""
    dlat, dlng = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * 6371.0 * asin(sqrt(a))


def eta_minutes(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    """Minutos aproximados en motocarro (mínimo 1)."""
    km = distance_km(lat1, lng1, lat2, lng2) * ROAD_FACTOR
    return max(1, round(km / AVERAGE_KMH * 60))

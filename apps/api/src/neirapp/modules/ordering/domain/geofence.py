"""Misma geocerca que `neirapp.modules.stores.domain.geofence`, duplicada a propósito.

Es una función pura de ~20 líneas sin dependencias; importarla del módulo `stores` acoplaría el
dominio de `ordering` a otro módulo de negocio (justo lo que las capas de dominio evitan en esta
arquitectura). Si el polígono real de Neira reemplaza el placeholder, hay que actualizar los dos
archivos — ver la nota sobre esto en docs/ARCHITECTURE.md.
"""

NEIRA_POLYGON: tuple[tuple[float, float], ...] = (
    (5.200, -75.570),
    (5.200, -75.470),
    (5.130, -75.470),
    (5.130, -75.570),
)


def is_within_neira(lat: float, lng: float) -> bool:
    inside = False
    n = len(NEIRA_POLYGON)
    x, y = lng, lat
    for i in range(n):
        y1, x1 = NEIRA_POLYGON[i]
        y2, x2 = NEIRA_POLYGON[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            x_intersect = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < x_intersect:
                inside = not inside
    return inside

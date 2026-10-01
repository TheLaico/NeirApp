"""Restringe tiendas y productos al municipio de Neira, Caldas.

El cliente solo debe ver tiendas de Neira (requisito del negocio), y el cliente puede manipularse,
así que la validación real va en el servidor. Aquí basta un polígono simple: no hace falta PostGIS
para un punto-en-polígono con pocos vértices, y esto sigue siendo Python puro (sin dependencias)
para que el dominio no dependa de infraestructura.

Los vértices son un rectángulo aproximado alrededor del casco urbano de Neira, Caldas
(~5.1667° N, -75.5167° O). Es un placeholder: antes de producción debe reemplazarse por el
polígono real del municipio (ver docs/ARCHITECTURE.md, "Riesgos abiertos").
"""

NEIRA_POLYGON: tuple[tuple[float, float], ...] = (
    (5.200, -75.570),
    (5.200, -75.470),
    (5.130, -75.470),
    (5.130, -75.570),
)


def is_within_neira(lat: float, lng: float) -> bool:
    """Ray casting sobre `NEIRA_POLYGON`. `lat` es Y, `lng` es X."""
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

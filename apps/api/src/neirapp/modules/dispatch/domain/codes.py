"""Códigos de confirmación (recogida y entrega).

A propósito NO van hasheados, a diferencia del refresh token de `identity`: un refresh token es
una credencial que abre toda la cuenta si se filtra; un código de recogida solo sirve para
confirmar el traspaso de un pedido puntual, en persona, con una vigencia de minutos u horas — el
radio de daño de que se filtre es mínimo. Guardarlo en claro permite además volver a mostrárselo al
repartidor si cierra la app, sin inventar un mecanismo de "un solo vistazo".
"""

import secrets

_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"  # sin 0/O/1/I/L: difícil de confundir al leerlo


def generate_code(length: int = 6) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))

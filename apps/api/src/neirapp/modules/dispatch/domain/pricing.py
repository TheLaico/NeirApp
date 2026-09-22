"""Cuánto gana el repartidor por una entrega.

Modelo de ingresos deliberadamente simple (tarifa plana + un extra por parada) — el plan original
dejó esto como una decisión pendiente del negocio ("tarifa por distancia, comisión, ambas"). Es un
placeholder fácil de reemplazar: todo lo que depende de esto llama a `compute_earnings_cop`, nunca
calcula el número por su cuenta.
"""

BASE_FEE_COP = 3_000
PER_STOP_FEE_COP = 1_500


def compute_earnings_cop(stop_count: int) -> int:
    return BASE_FEE_COP + PER_STOP_FEE_COP * stop_count

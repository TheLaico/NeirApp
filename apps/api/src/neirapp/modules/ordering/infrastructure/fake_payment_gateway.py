from uuid import UUID


class FakePaymentGateway:
    """Adaptador de desarrollo: aprueba cualquier cobro al instante, sin tarjeta ni redirección.

    Implementa el mismo puerto `PaymentGateway` que usaría un adaptador real (Wompi, ePayco,
    Mercado Pago) — cambiar de uno a otro es una línea en `bootstrap/container.py`, ningún caso de
    uso se entera. Una pasarela real normalmente sería asíncrona (redirección + webhook de
    confirmación en vez de una respuesta inmediata); ver la nota sobre esto en
    docs/ARCHITECTURE.md, "Riesgos abiertos".
    """

    async def charge(self, order_id: UUID, amount_cop: int) -> bool:
        return True

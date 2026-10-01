from neirapp.modules.pricing.application.ports import PricingStore
from neirapp.modules.pricing.domain.entities import DEFAULT_PRICING, DeliveryPricing


class GetDeliveryPricing:
    """La tarifa vigente: la del administrador o, si nunca la tocó, la de por defecto."""

    def __init__(self, store: PricingStore) -> None:
        self._store = store

    async def __call__(self) -> DeliveryPricing:
        return await self._store.get() or DEFAULT_PRICING


class UpdateDeliveryPricing:
    """Cambia la tarifa. Solo afecta a los pedidos nuevos: cada pedido guarda la de su creación."""

    def __init__(self, store: PricingStore) -> None:
        self._store = store

    async def __call__(
        self, *, delivery_fee_cop: int, courier_share_percent: int
    ) -> DeliveryPricing:
        pricing = DeliveryPricing(delivery_fee_cop, courier_share_percent)
        await self._store.save(pricing)
        return pricing

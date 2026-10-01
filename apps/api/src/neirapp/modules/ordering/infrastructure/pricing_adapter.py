from neirapp.modules.ordering.application.dto import DeliveryFeeSnapshot
from neirapp.modules.pricing.application.app import PricingApp


class PricingFeeAdapter:
    """Implementa `PricingPort` sobre la fachada pública de `pricing` (`PricingApp`)."""

    def __init__(self, pricing: PricingApp) -> None:
        self._pricing = pricing

    async def current_delivery_fee(self) -> DeliveryFeeSnapshot:
        pricing = await self._pricing.get_delivery_pricing()
        return DeliveryFeeSnapshot(
            delivery_fee_cop=pricing.delivery_fee_cop,
            courier_earnings_cop=pricing.courier_cop,
        )

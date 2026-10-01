from typing import Protocol

from neirapp.modules.pricing.domain.entities import DeliveryPricing


class PricingStore(Protocol):
    async def get(self) -> DeliveryPricing | None: ...

    async def save(self, pricing: DeliveryPricing) -> None: ...

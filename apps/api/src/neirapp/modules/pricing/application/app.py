from dataclasses import dataclass

from neirapp.modules.pricing.application.pricing import GetDeliveryPricing, UpdateDeliveryPricing


@dataclass(frozen=True)
class PricingApp:
    get_delivery_pricing: GetDeliveryPricing
    update_delivery_pricing: UpdateDeliveryPricing

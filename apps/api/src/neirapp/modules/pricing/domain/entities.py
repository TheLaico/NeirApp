from dataclasses import dataclass

from neirapp.modules.pricing.domain.errors import InvalidCourierShare, InvalidDeliveryFee

MAX_DELIVERY_FEE_COP = 100_000


def split_delivery_fee(fee_cop: int, courier_share_percent: int) -> tuple[int, int]:
    """(lo del repartidor, lo de la plataforma). El repartidor se lleva la parte entera de su
    porcentaje y el resto va a la plataforma, así la suma siempre es exactamente el envío."""
    courier = fee_cop * courier_share_percent // 100
    return courier, fee_cop - courier


@dataclass(frozen=True)
class DeliveryPricing:
    """Cuánto se le cobra al cliente por el envío de un pedido y cómo se reparte: el porcentaje
    `courier_share_percent` es para el repartidor y el resto para la plataforma (admin)."""

    delivery_fee_cop: int
    courier_share_percent: int

    def __post_init__(self) -> None:
        if not 0 <= self.delivery_fee_cop <= MAX_DELIVERY_FEE_COP:
            raise InvalidDeliveryFee()
        if not 0 <= self.courier_share_percent <= 100:
            raise InvalidCourierShare()

    @property
    def platform_share_percent(self) -> int:
        return 100 - self.courier_share_percent

    @property
    def courier_cop(self) -> int:
        return split_delivery_fee(self.delivery_fee_cop, self.courier_share_percent)[0]

    @property
    def platform_cop(self) -> int:
        return split_delivery_fee(self.delivery_fee_cop, self.courier_share_percent)[1]


DEFAULT_PRICING = DeliveryPricing(delivery_fee_cop=5_000, courier_share_percent=80)

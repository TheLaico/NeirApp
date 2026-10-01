from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import require_roles
from neirapp.modules.pricing.domain.entities import MAX_DELIVERY_FEE_COP, DeliveryPricing
from neirapp.modules.pricing.presentation.dependencies import PricingDep

RequireAdmin = Annotated[User, Depends(require_roles(Role.ADMIN))]

router = APIRouter(tags=["pricing"])


class UpdateDeliveryPricingRequest(BaseModel):
    delivery_fee_cop: int = Field(ge=0, le=MAX_DELIVERY_FEE_COP)
    courier_share_percent: int = Field(ge=0, le=100)


class DeliveryPricingResponse(BaseModel):
    delivery_fee_cop: int
    courier_share_percent: int
    platform_share_percent: int
    courier_cop: int
    platform_cop: int

    @classmethod
    def from_domain(cls, pricing: DeliveryPricing) -> "DeliveryPricingResponse":
        return cls(
            delivery_fee_cop=pricing.delivery_fee_cop,
            courier_share_percent=pricing.courier_share_percent,
            platform_share_percent=pricing.platform_share_percent,
            courier_cop=pricing.courier_cop,
            platform_cop=pricing.platform_cop,
        )


@router.get("/pricing/delivery", response_model=DeliveryPricingResponse)
async def get_delivery_pricing(pricing: PricingDep) -> DeliveryPricingResponse:
    """Lo que cuesta el envío hoy; público porque el cliente lo ve antes de pagar."""
    return DeliveryPricingResponse.from_domain(await pricing.get_delivery_pricing())


@router.put("/pricing/delivery", response_model=DeliveryPricingResponse)
async def update_delivery_pricing(
    body: UpdateDeliveryPricingRequest, _admin: RequireAdmin, pricing: PricingDep
) -> DeliveryPricingResponse:
    """Configura el valor del envío y el reparto entre repartidor y plataforma (solo admin)."""
    updated = await pricing.update_delivery_pricing(
        delivery_fee_cop=body.delivery_fee_cop, courier_share_percent=body.courier_share_percent
    )
    return DeliveryPricingResponse.from_domain(updated)

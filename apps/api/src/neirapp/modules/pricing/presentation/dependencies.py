from typing import Annotated

from fastapi import Depends, Request

from neirapp.modules.pricing.application.app import PricingApp


def get_pricing(request: Request) -> PricingApp:
    pricing: PricingApp = request.app.state.pricing
    return pricing


PricingDep = Annotated[PricingApp, Depends(get_pricing)]

from typing import Annotated

from fastapi import Depends, Request

from neirapp.modules.marketplace.application.app import MarketplaceApp


def get_marketplace(request: Request) -> MarketplaceApp:
    marketplace: MarketplaceApp = request.app.state.marketplace
    return marketplace


MarketplaceDep = Annotated[MarketplaceApp, Depends(get_marketplace)]

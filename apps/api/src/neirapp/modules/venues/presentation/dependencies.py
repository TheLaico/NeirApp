from typing import Annotated

from fastapi import Depends, Request

from neirapp.modules.venues.application.app import VenuesApp


def get_venues(request: Request) -> VenuesApp:
    venues: VenuesApp = request.app.state.venues
    return venues


VenuesDep = Annotated[VenuesApp, Depends(get_venues)]

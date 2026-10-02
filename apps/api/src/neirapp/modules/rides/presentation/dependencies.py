from typing import Annotated

from fastapi import Depends, Request

from neirapp.modules.rides.application.app import RidesApp


def get_rides(request: Request) -> RidesApp:
    rides: RidesApp = request.app.state.rides
    return rides


RidesDep = Annotated[RidesApp, Depends(get_rides)]

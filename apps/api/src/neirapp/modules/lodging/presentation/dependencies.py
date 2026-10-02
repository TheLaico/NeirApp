from typing import Annotated

from fastapi import Depends, Request

from neirapp.modules.lodging.application.app import LodgingApp


def get_lodging(request: Request) -> LodgingApp:
    lodging: LodgingApp = request.app.state.lodging
    return lodging


LodgingDep = Annotated[LodgingApp, Depends(get_lodging)]

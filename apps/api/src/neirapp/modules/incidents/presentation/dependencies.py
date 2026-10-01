from typing import Annotated

from fastapi import Depends, Request

from neirapp.modules.incidents.application.app import IncidentsApp


def get_incidents(request: Request) -> IncidentsApp:
    incidents: IncidentsApp = request.app.state.incidents
    return incidents


IncidentsDep = Annotated[IncidentsApp, Depends(get_incidents)]

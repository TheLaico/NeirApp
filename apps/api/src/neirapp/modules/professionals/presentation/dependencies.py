from typing import Annotated

from fastapi import Depends, Request

from neirapp.modules.professionals.application.app import ProfessionalsApp


def get_professionals(request: Request) -> ProfessionalsApp:
    professionals: ProfessionalsApp = request.app.state.professionals
    return professionals


ProfessionalsDep = Annotated[ProfessionalsApp, Depends(get_professionals)]

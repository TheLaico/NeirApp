from typing import Annotated

from fastapi import Depends, Request

from neirapp.modules.leads.application.app import LeadsApp


def get_leads(request: Request) -> LeadsApp:
    leads: LeadsApp = request.app.state.leads
    return leads


LeadsDep = Annotated[LeadsApp, Depends(get_leads)]

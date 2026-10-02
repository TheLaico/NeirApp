from dataclasses import dataclass

from neirapp.modules.leads.application.applications import (
    ListApplications,
    SetApplicationContacted,
    SubmitApplication,
)
from neirapp.modules.leads.application.leads import ListLeads, SetLeadContacted, SubmitLead


@dataclass(frozen=True)
class LeadsApp:
    submit_lead: SubmitLead
    list_leads: ListLeads
    set_lead_contacted: SetLeadContacted
    # "¿Quieres formar parte de NeirAPP?": solicitudes para entrar con un rol.
    submit_application: SubmitApplication
    list_applications: ListApplications
    set_application_contacted: SetApplicationContacted

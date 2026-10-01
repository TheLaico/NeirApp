from dataclasses import dataclass

from neirapp.modules.leads.application.leads import ListLeads, SetLeadContacted, SubmitLead


@dataclass(frozen=True)
class LeadsApp:
    submit_lead: SubmitLead
    list_leads: ListLeads
    set_lead_contacted: SetLeadContacted

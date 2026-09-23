from dataclasses import dataclass

from neirapp.modules.incidents.application.incidents import (
    ListIncidents,
    ListMyIncidents,
    ReportIncident,
    ResolveIncident,
)


@dataclass(frozen=True)
class IncidentsApp:
    report_incident: ReportIncident
    list_my_incidents: ListMyIncidents
    list_incidents: ListIncidents
    resolve_incident: ResolveIncident

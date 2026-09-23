from neirapp.shared.domain.errors import NotFoundError, PermissionDeniedError, ValidationError


class EmptyDescription(ValidationError):
    code = "empty_description"

    @classmethod
    def default_message(cls) -> str:
        return "Describe brevemente qué pasó."


class NotAuthorizedToReport(PermissionDeniedError):
    code = "not_authorized_to_report"

    @classmethod
    def default_message(cls) -> str:
        return "Solo el cliente o el repartidor de este pedido pueden reportar un problema."


class IncidentNotFound(NotFoundError):
    code = "incident_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Reporte no encontrado."


class IncidentAlreadyResolved(ValidationError):
    code = "incident_already_resolved"

    @classmethod
    def default_message(cls) -> str:
        return "Este reporte ya se resolvió."

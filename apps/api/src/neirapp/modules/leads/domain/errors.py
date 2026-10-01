from neirapp.shared.domain.errors import NotFoundError, ValidationError


class InvalidContactName(ValidationError):
    code = "invalid_contact_name"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe el nombre de la persona de contacto."


class InvalidBusinessName(ValidationError):
    code = "invalid_business_name"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe el nombre de la empresa o del negocio."


class InvalidContactPhone(ValidationError):
    code = "invalid_contact_phone"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe un teléfono de contacto válido (entre 7 y 15 dígitos)."


class LeadNotFound(NotFoundError):
    code = "lead_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Solicitud no encontrada."

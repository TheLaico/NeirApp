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


class InvalidApplicationRole(ValidationError):
    code = "invalid_application_role"

    @classmethod
    def default_message(cls) -> str:
        return "Elige cómo quieres formar parte de NeirAPP."


class InvalidDocumentNumber(ValidationError):
    code = "invalid_document_number"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe tu número de documento (entre 5 y 15 dígitos)."


class InvalidContactEmail(ValidationError):
    code = "invalid_contact_email"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe un correo electrónico válido."


class MissingCompanyName(ValidationError):
    code = "missing_company_name"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe el nombre de la empresa o del negocio."


class InvalidApplicationDetails(ValidationError):
    code = "invalid_application_details"

    @classmethod
    def default_message(cls) -> str:
        return "Revisa los datos del formulario: alguno es demasiado largo."

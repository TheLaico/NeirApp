"""Errores base del dominio.

Cada categoría corresponde a una clase de fallo de negocio. La capa de presentación decide
cómo traducirlas (por ejemplo a códigos HTTP); el dominio no sabe nada de HTTP.
"""


class DomainError(Exception):
    """Error de negocio. `code` es un identificador estable que el cliente puede usar."""

    code = "domain_error"

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.default_message()
        super().__init__(self.message)

    @classmethod
    def default_message(cls) -> str:
        return "Ocurrió un error de negocio."


class ValidationError(DomainError):
    code = "validation_error"


class NotFoundError(DomainError):
    code = "not_found"


class ConflictError(DomainError):
    code = "conflict"


class AuthenticationError(DomainError):
    code = "authentication_failed"


class PermissionDeniedError(DomainError):
    code = "permission_denied"

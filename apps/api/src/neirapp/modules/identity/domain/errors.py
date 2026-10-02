from neirapp.shared.domain.errors import (
    AuthenticationError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)


class EmailAlreadyRegistered(ConflictError):
    code = "email_already_registered"

    @classmethod
    def default_message(cls) -> str:
        return "Ya existe una cuenta con ese correo."


class InvalidCredentials(AuthenticationError):
    code = "invalid_credentials"

    @classmethod
    def default_message(cls) -> str:
        return "Correo o contraseña incorrectos."


class InvalidToken(AuthenticationError):
    code = "invalid_token"

    @classmethod
    def default_message(cls) -> str:
        return "La sesión no es válida o expiró."


class InactiveAccount(PermissionDeniedError):
    code = "inactive_account"

    @classmethod
    def default_message(cls) -> str:
        return "La cuenta está desactivada."


class InsufficientRole(PermissionDeniedError):
    code = "insufficient_role"

    @classmethod
    def default_message(cls) -> str:
        return "No tienes permisos para realizar esta acción."


class UserNotFound(NotFoundError):
    code = "user_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Usuario no encontrado."


class InvalidEmail(ValidationError):
    code = "invalid_email"

    @classmethod
    def default_message(cls) -> str:
        return "El correo no es válido."


class InvalidPhone(ValidationError):
    code = "invalid_phone"

    @classmethod
    def default_message(cls) -> str:
        return "El teléfono debe ser un celular colombiano de 10 dígitos (ej. 300 123 4567)."


class WeakPassword(ValidationError):
    code = "weak_password"

    @classmethod
    def default_message(cls) -> str:
        return "La contraseña debe tener entre 8 y 128 caracteres."


class WrongCurrentPassword(ValidationError):
    code = "wrong_current_password"

    @classmethod
    def default_message(cls) -> str:
        return "Tu contraseña actual no es correcta."


class SamePassword(ValidationError):
    code = "same_password"

    @classmethod
    def default_message(cls) -> str:
        return "La contraseña nueva debe ser distinta de la actual."


class InvalidFullName(ValidationError):
    code = "invalid_full_name"

    @classmethod
    def default_message(cls) -> str:
        return "El nombre debe tener entre 2 y 120 caracteres."


class RoleNotAssignable(ValidationError):
    code = "role_not_assignable"

    @classmethod
    def default_message(cls) -> str:
        return "Ese rol no se puede autorizar por correo. Usa repartidor, comerciante o profesional."


class TermsNotAccepted(ValidationError):
    code = "terms_not_accepted"

    @classmethod
    def default_message(cls) -> str:
        return "Debes aceptar los términos y condiciones y la política de privacidad."


class TermsVersionMismatch(ValidationError):
    code = "terms_version_mismatch"

    @classmethod
    def default_message(cls) -> str:
        return "La versión de los términos aceptada no es la vigente."

from neirapp.shared.domain.errors import ConflictError, NotFoundError, ValidationError


class InvalidFullName(ValidationError):
    code = "invalid_full_name"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe tu nombre completo (entre 3 y 80 caracteres)."


class InvalidTitle(ValidationError):
    code = "invalid_title"

    @classmethod
    def default_message(cls) -> str:
        return "Elige un título de la lista."


class InvalidCategory(ValidationError):
    code = "invalid_category"

    @classmethod
    def default_message(cls) -> str:
        return "Elige tu área y especialidad de la lista."


class InvalidExperience(ValidationError):
    code = "invalid_experience"

    @classmethod
    def default_message(cls) -> str:
        return "Los años de experiencia deben estar entre 0 y 70."


class TextTooLong(ValidationError):
    code = "text_too_long"

    @classmethod
    def default_message(cls) -> str:
        return "Uno de los textos es demasiado largo."


class InvalidPhone(ValidationError):
    code = "invalid_phone"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe un celular colombiano de 10 dígitos, por ejemplo 310 123 4567."


class InvalidContactEmail(ValidationError):
    code = "invalid_contact_email"

    @classmethod
    def default_message(cls) -> str:
        return "Revisa el correo de contacto."


class NoModality(ValidationError):
    code = "no_modality"

    @classmethod
    def default_message(cls) -> str:
        return "Elige al menos una forma de atender: consultorio, a domicilio o virtual."


class InvalidPhotoUrl(ValidationError):
    code = "invalid_photo_url"

    @classmethod
    def default_message(cls) -> str:
        return "La foto debe subirse desde la app."


class ProfileNotFound(NotFoundError):
    code = "professional_profile_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Todavía no has creado tu perfil profesional."


class InvalidCategoryLabel(ValidationError):
    code = "invalid_category_label"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe un nombre de entre 2 y 60 caracteres."


class InvalidIcon(ValidationError):
    code = "invalid_icon"

    @classmethod
    def default_message(cls) -> str:
        return "Elige un ícono de la lista."


class InvalidColor(ValidationError):
    code = "invalid_color"

    @classmethod
    def default_message(cls) -> str:
        return "El color debe ser un código como #0f5238."


class CategoryNotFound(NotFoundError):
    code = "category_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Categoría no encontrada."


class SubcategoryNotFound(NotFoundError):
    code = "subcategory_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Subcategoría no encontrada."


class CategoryInUse(ConflictError):
    code = "category_in_use"

    @classmethod
    def default_message(cls) -> str:
        return (
            "Hay profesionales con perfil en esta categoría. "
            "Pídeles que la cambien antes de borrarla."
        )

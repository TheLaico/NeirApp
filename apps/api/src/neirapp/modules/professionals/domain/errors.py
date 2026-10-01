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


class InvalidServiceName(ValidationError):
    code = "invalid_service_name"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe el nombre del servicio (entre 3 y 80 caracteres)."


class InvalidServicePrice(ValidationError):
    code = "invalid_service_price"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe un precio entre $1.000 y $50.000.000, o elige “A convenir”."


class InvalidServiceDuration(ValidationError):
    code = "invalid_service_duration"

    @classmethod
    def default_message(cls) -> str:
        return "La duración debe estar entre 5 minutos y 12 horas."


class TooManyServices(ValidationError):
    code = "too_many_services"

    @classmethod
    def default_message(cls) -> str:
        return "Puedes tener hasta 30 servicios. Borra alguno para agregar otro."


class ServiceNotFound(NotFoundError):
    code = "service_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Servicio no encontrado."


class InvalidGalleryImage(ValidationError):
    code = "invalid_gallery_image"

    @classmethod
    def default_message(cls) -> str:
        return "La imagen debe subirse desde la app."


class TooManyImages(ValidationError):
    code = "too_many_images"

    @classmethod
    def default_message(cls) -> str:
        return "Puedes tener hasta 30 imágenes en tu galería. Borra alguna para agregar otra."


class InvalidGalleryOrder(ValidationError):
    code = "invalid_gallery_order"

    @classmethod
    def default_message(cls) -> str:
        return "El nuevo orden debe incluir todas tus imágenes, sin repetir."


class GalleryImageNotFound(NotFoundError):
    code = "gallery_image_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Imagen no encontrada."


class InvalidCertificateTitle(ValidationError):
    code = "invalid_certificate_title"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe el nombre del título o certificado (entre 3 y 100 caracteres)."


class InvalidCertificateYear(ValidationError):
    code = "invalid_certificate_year"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe un año válido, por ejemplo 2018."


class InvalidCertificateFile(ValidationError):
    code = "invalid_certificate_file"

    @classmethod
    def default_message(cls) -> str:
        return "Adjunta el certificado como PDF o foto, subido desde la app."


class TooManyCertificates(ValidationError):
    code = "too_many_certificates"

    @classmethod
    def default_message(cls) -> str:
        return "Puedes tener hasta 20 certificados. Borra alguno para agregar otro."


class CertificateNotFound(NotFoundError):
    code = "certificate_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Certificado no encontrado."


class MissingReviewNote(ValidationError):
    code = "missing_review_note"

    @classmethod
    def default_message(cls) -> str:
        return "Cuéntale al profesional por qué no se aprobó (entre 5 y 200 caracteres)."


class InvalidAppointmentRequest(ValidationError):
    code = "invalid_appointment_request"

    @classmethod
    def default_message(cls) -> str:
        return "Revisa los datos de la solicitud."


class CannotRequestYourself(ValidationError):
    code = "cannot_request_yourself"

    @classmethod
    def default_message(cls) -> str:
        return "No puedes pedirte una cita a ti mismo."


class TooManyPendingRequests(ValidationError):
    code = "too_many_pending_requests"

    @classmethod
    def default_message(cls) -> str:
        return "Ya tienes 3 solicitudes esperando respuesta de este profesional."


class AppointmentRequestNotFound(NotFoundError):
    code = "appointment_request_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Solicitud no encontrada."


class InvalidRequestTransition(ConflictError):
    code = "invalid_request_transition"

    @classmethod
    def default_message(cls) -> str:
        return "Esta solicitud ya no se puede cambiar así."

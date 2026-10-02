from neirapp.shared.domain.errors import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)


class InvalidListingTitle(ValidationError):
    code = "invalid_listing_title"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe el nombre del inmueble (entre 3 y 80 caracteres)."


class InvalidListingCategory(ValidationError):
    code = "invalid_listing_category"

    @classmethod
    def default_message(cls) -> str:
        return "Elige una categoría de la lista."


class InvalidListingPrice(ValidationError):
    code = "invalid_listing_price"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe el precio, o marca que lo negocias por chat."


class InvalidListingQuantity(ValidationError):
    code = "invalid_listing_quantity"

    @classmethod
    def default_message(cls) -> str:
        return "La cantidad disponible debe estar entre 1 y 999."


class InvalidListingDescription(ValidationError):
    code = "invalid_listing_description"

    @classmethod
    def default_message(cls) -> str:
        return "Cuenta cómo es el inmueble (entre 10 y 1000 caracteres)."


class InvalidListingPhotos(ValidationError):
    code = "invalid_listing_photos"

    @classmethod
    def default_message(cls) -> str:
        return "Agrega entre 1 y 8 fotos del inmueble."


class InvalidSellerPhone(ValidationError):
    code = "invalid_seller_phone"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe un WhatsApp de 10 dígitos, por ejemplo 310 123 4567."


class TooManyListings(ValidationError):
    code = "too_many_listings"

    @classmethod
    def default_message(cls) -> str:
        return "Puedes tener hasta 30 publicaciones. Elimina alguna para crear otra."


class ListingNotFound(NotFoundError):
    code = "listing_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Esta publicación ya no está disponible."


class ListingRemoved(PermissionDeniedError):
    code = "listing_removed"

    @classmethod
    def default_message(cls) -> str:
        return "El equipo de NeirAPP retiró esta publicación. Escríbenos si crees que es un error."


class PaymentPending(ConflictError):
    code = "listing_payment_pending"

    @classmethod
    def default_message(cls) -> str:
        return "Ya enviaste un pago de esta publicación; estamos confirmándolo."


class PaymentNotFound(NotFoundError):
    code = "listing_payment_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Pago no encontrado."


class InvalidPaymentTransition(ConflictError):
    code = "invalid_listing_payment_transition"

    @classmethod
    def default_message(cls) -> str:
        return "Este pago ya fue revisado."


class InvalidPaymentReference(ValidationError):
    code = "invalid_listing_payment_reference"

    @classmethod
    def default_message(cls) -> str:
        return "El comprobante puede tener hasta 120 caracteres."


class MissingNote(ValidationError):
    code = "missing_note"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe el motivo."


class CannotReportOwnListing(ValidationError):
    code = "cannot_report_own_listing"

    @classmethod
    def default_message(cls) -> str:
        return "No puedes reportar tu propia publicación."


class AlreadyReported(ConflictError):
    code = "already_reported"

    @classmethod
    def default_message(cls) -> str:
        return "Ya reportaste esta publicación. Nuestro equipo la está revisando."


class InvalidReportDetails(ValidationError):
    code = "invalid_report_details"

    @classmethod
    def default_message(cls) -> str:
        return "Cuéntanos qué pasa (hasta 500 caracteres)."

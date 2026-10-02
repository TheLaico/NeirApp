from neirapp.shared.domain.errors import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)


class InvalidHotelName(ValidationError):
    code = "invalid_hotel_name"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe el nombre del hospedaje (entre 2 y 80 caracteres)."


class InvalidHotelDescription(ValidationError):
    code = "invalid_hotel_description"

    @classmethod
    def default_message(cls) -> str:
        return "Cuenta cómo es tu hospedaje (entre 20 y 1000 caracteres)."


class InvalidHotelText(ValidationError):
    code = "invalid_hotel_text"

    @classmethod
    def default_message(cls) -> str:
        return "Uno de los textos es demasiado largo."


class InvalidHotelLocation(ValidationError):
    code = "invalid_hotel_location"

    @classmethod
    def default_message(cls) -> str:
        return "Marca en el mapa dónde queda tu hospedaje (dentro de Neira)."


class InvalidHotelPhone(ValidationError):
    code = "invalid_hotel_phone"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe un teléfono de 7 a 10 dígitos."


class InvalidHotelWhatsapp(ValidationError):
    code = "invalid_hotel_whatsapp"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe un WhatsApp de 10 dígitos, por ejemplo 310 123 4567."


class InvalidHotelEmail(ValidationError):
    code = "invalid_hotel_email"

    @classmethod
    def default_message(cls) -> str:
        return "Revisa el correo de contacto."


class InvalidHotelPrice(ValidationError):
    code = "invalid_hotel_price"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe el precio por noche (desde)."


class InvalidHotelPhotos(ValidationError):
    code = "invalid_hotel_photos"

    @classmethod
    def default_message(cls) -> str:
        return "Agrega entre 1 y 12 fotos subidas desde la app."


class HotelNotFound(NotFoundError):
    code = "hotel_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Hospedaje no encontrado."


class InvalidReview(ValidationError):
    code = "invalid_review"

    @classmethod
    def default_message(cls) -> str:
        return "Califica de 1 a 5 estrellas (el comentario puede tener hasta 500 caracteres)."


class CannotReviewOwnHotel(ValidationError):
    code = "cannot_review_own_hotel"

    @classmethod
    def default_message(cls) -> str:
        return "No puedes calificar tu propio hospedaje."


class ReviewNotFound(NotFoundError):
    code = "review_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Reseña no encontrada."


class InvalidReply(ValidationError):
    code = "invalid_reply"

    @classmethod
    def default_message(cls) -> str:
        return "La respuesta puede tener entre 2 y 500 caracteres."


class InvalidReservation(ValidationError):
    code = "invalid_reservation"

    @classmethod
    def default_message(cls) -> str:
        return "Revisa las fechas, los huéspedes y tu celular."


class CannotBookOwnHotel(ValidationError):
    code = "cannot_book_own_hotel"

    @classmethod
    def default_message(cls) -> str:
        return "No puedes reservar en tu propio hospedaje."


class TooManyPendingReservations(ValidationError):
    code = "too_many_pending_reservations"

    @classmethod
    def default_message(cls) -> str:
        return "Ya tienes 3 reservas esperando respuesta de este hospedaje."


class ReservationNotFound(NotFoundError):
    code = "reservation_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Reserva no encontrada."


class InvalidReservationTransition(ConflictError):
    code = "invalid_reservation_transition"

    @classmethod
    def default_message(cls) -> str:
        return "Esta reserva ya no se puede cambiar así."


class NotYourHotel(PermissionDeniedError):
    code = "not_your_hotel"

    @classmethod
    def default_message(cls) -> str:
        return "Esto es del hospedaje y solo lo puede hacer su dueño."


class InvalidPaymentReference(ValidationError):
    code = "invalid_hotel_payment_reference"

    @classmethod
    def default_message(cls) -> str:
        return "El comprobante puede tener hasta 120 caracteres."


class InvalidPaymentTransition(ConflictError):
    code = "invalid_hotel_payment_transition"

    @classmethod
    def default_message(cls) -> str:
        return "Este pago ya fue revisado."


class PaymentPending(ConflictError):
    code = "hotel_payment_pending"

    @classmethod
    def default_message(cls) -> str:
        return "Ya enviaste ese pago; estamos confirmándolo."


class PaymentNotFound(NotFoundError):
    code = "hotel_payment_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Pago no encontrado."


class MissingNote(ValidationError):
    code = "missing_hotel_payment_note"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe el motivo."


class HotelRequired(ValidationError):
    code = "hotel_profile_required"

    @classmethod
    def default_message(cls) -> str:
        return "Primero crea la ficha de tu hotel en Mi hotel."

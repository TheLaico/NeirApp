from neirapp.shared.domain.errors import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)


class InvalidVenueName(ValidationError):
    code = "invalid_venue_name"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe el nombre del lugar (entre 2 y 80 caracteres)."


class InvalidVenueDescription(ValidationError):
    code = "invalid_venue_description"

    @classmethod
    def default_message(cls) -> str:
        return "Cuenta cómo es el lugar (entre 20 y 1000 caracteres)."


class InvalidVenueText(ValidationError):
    code = "invalid_venue_text"

    @classmethod
    def default_message(cls) -> str:
        return "Uno de los textos es demasiado largo."


class InvalidVenueLocation(ValidationError):
    code = "invalid_venue_location"

    @classmethod
    def default_message(cls) -> str:
        return "Marca en el mapa dónde queda el lugar (dentro de Neira)."


class InvalidVenuePhone(ValidationError):
    code = "invalid_venue_phone"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe un teléfono de 7 a 10 dígitos."


class InvalidVenueWhatsapp(ValidationError):
    code = "invalid_venue_whatsapp"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe un WhatsApp de 10 dígitos, por ejemplo 310 123 4567."


class InvalidVenueEmail(ValidationError):
    code = "invalid_venue_email"

    @classmethod
    def default_message(cls) -> str:
        return "Revisa el correo de contacto."


class InvalidVenuePrice(ValidationError):
    code = "invalid_venue_price"

    @classmethod
    def default_message(cls) -> str:
        return "Revisa el precio (puede ser 0 si se consulta con el lugar)."


class InvalidVenuePhotos(ValidationError):
    code = "invalid_venue_photos"

    @classmethod
    def default_message(cls) -> str:
        return "Agrega entre 1 y 12 fotos subidas desde la app."


class InvalidVenueSchedule(ValidationError):
    code = "invalid_venue_schedule"

    @classmethod
    def default_message(cls) -> str:
        return "Revisa el horario: hora de apertura y cierre, y al menos un día de atención."


class InvalidVenueCapacity(ValidationError):
    code = "invalid_venue_capacity"

    @classmethod
    def default_message(cls) -> str:
        return "El máximo de personas por reserva va de 1 a 500."


class VenueNotFound(NotFoundError):
    code = "venue_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Lugar no encontrado."


class InvalidReview(ValidationError):
    code = "invalid_venue_review"

    @classmethod
    def default_message(cls) -> str:
        return "Califica de 1 a 5 estrellas (el comentario puede tener hasta 500 caracteres)."


class CannotReviewOwnVenue(ValidationError):
    code = "cannot_review_own_venue"

    @classmethod
    def default_message(cls) -> str:
        return "No puedes calificar tu propio lugar."


class ReviewNotFound(NotFoundError):
    code = "venue_review_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Reseña no encontrada."


class InvalidReply(ValidationError):
    code = "invalid_venue_reply"

    @classmethod
    def default_message(cls) -> str:
        return "La respuesta puede tener entre 2 y 500 caracteres."


class InvalidBooking(ValidationError):
    code = "invalid_booking"

    @classmethod
    def default_message(cls) -> str:
        return "Revisa la fecha, la hora, las personas y tu celular."


class VenueClosed(ValidationError):
    code = "venue_closed"

    @classmethod
    def default_message(cls) -> str:
        return "El lugar no atiende ese día o a esa hora. Revisa su horario."


class TooManyPeople(ValidationError):
    code = "too_many_people"

    @classmethod
    def default_message(cls) -> str:
        return "Son más personas de las que el lugar recibe por reserva."


class CannotBookOwnVenue(ValidationError):
    code = "cannot_book_own_venue"

    @classmethod
    def default_message(cls) -> str:
        return "No puedes reservar en tu propio lugar."


class TooManyPendingBookings(ValidationError):
    code = "too_many_pending_bookings"

    @classmethod
    def default_message(cls) -> str:
        return "Ya tienes 3 reservas esperando respuesta de este lugar."


class BookingNotFound(NotFoundError):
    code = "booking_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Reserva no encontrada."


class InvalidBookingTransition(ConflictError):
    code = "invalid_booking_transition"

    @classmethod
    def default_message(cls) -> str:
        return "Esta reserva ya no se puede cambiar así."


class NotYourVenue(PermissionDeniedError):
    code = "not_your_venue"

    @classmethod
    def default_message(cls) -> str:
        return "Esto es del lugar y solo lo puede hacer su dueño."

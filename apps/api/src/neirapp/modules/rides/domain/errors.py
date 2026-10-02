from neirapp.shared.domain.errors import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)


class InvalidDriverName(ValidationError):
    code = "invalid_driver_name"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe tu nombre (entre 2 y 80 caracteres)."


class InvalidDriverPhone(ValidationError):
    code = "invalid_driver_phone"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe un celular de 10 dígitos, por ejemplo 310 123 4567."


class InvalidPlate(ValidationError):
    code = "invalid_plate"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe la placa del motocarro (letras y números, por ejemplo NEI-123)."


class InvalidVehicle(ValidationError):
    code = "invalid_vehicle"

    @classmethod
    def default_message(cls) -> str:
        return "Revisa el modelo, el año y la capacidad (1 a 3 pasajeros) del motocarro."


class InvalidDriverPhoto(ValidationError):
    code = "invalid_driver_photo"

    @classmethod
    def default_message(cls) -> str:
        return "Sube la foto desde la app."


class DriverProfileRequired(ValidationError):
    code = "driver_profile_required"

    @classmethod
    def default_message(cls) -> str:
        return "Primero completa tu perfil y el de tu motocarro."


class InvalidLocation(ValidationError):
    code = "invalid_ride_location"

    @classmethod
    def default_message(cls) -> str:
        return "Esa ubicación queda por fuera de Neira. Ajústala en el mapa."


class InvalidRideRequest(ValidationError):
    code = "invalid_ride_request"

    @classmethod
    def default_message(cls) -> str:
        return "Indica cuántas personas van (1 a 3) y dónde te recogen."


class ActiveRideExists(ConflictError):
    code = "active_ride_exists"

    @classmethod
    def default_message(cls) -> str:
        return "Ya tienes un viaje en curso."


class DriverBusy(ConflictError):
    code = "driver_busy"

    @classmethod
    def default_message(cls) -> str:
        return "Ya tienes un viaje en curso: termínalo antes de aceptar otro."


class DriverOffline(ConflictError):
    code = "driver_offline"

    @classmethod
    def default_message(cls) -> str:
        return "Activa 'Disponible' para recibir y aceptar solicitudes."


class TooManyPassengers(ValidationError):
    code = "too_many_passengers"

    @classmethod
    def default_message(cls) -> str:
        return "Tu motocarro no tiene cupo para tantas personas."


class RideTaken(ConflictError):
    code = "ride_taken"

    @classmethod
    def default_message(cls) -> str:
        return "Otro conductor ya aceptó esta solicitud (o la cancelaron)."


class RideNotFound(NotFoundError):
    code = "ride_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Viaje no encontrado."


class InvalidRideTransition(ConflictError):
    code = "invalid_ride_transition"

    @classmethod
    def default_message(cls) -> str:
        return "Este viaje ya no se puede cambiar así."


class NotYourRide(PermissionDeniedError):
    code = "not_your_ride"

    @classmethod
    def default_message(cls) -> str:
        return "Este viaje no es tuyo."


class InvalidRating(ValidationError):
    code = "invalid_ride_rating"

    @classmethod
    def default_message(cls) -> str:
        return "Califica de 1 a 5 estrellas (el comentario puede tener hasta 300 caracteres)."

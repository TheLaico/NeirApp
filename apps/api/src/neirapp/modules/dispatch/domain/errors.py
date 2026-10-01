from neirapp.shared.domain.errors import NotFoundError, PermissionDeniedError, ValidationError


class CourierProfileNotFound(NotFoundError):
    code = "courier_profile_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "No tienes un perfil de repartidor."


class CourierProfileAlreadyExists(ValidationError):
    code = "courier_profile_already_exists"

    @classmethod
    def default_message(cls) -> str:
        return "Ya tienes un perfil de repartidor."


class CourierNotVerified(PermissionDeniedError):
    code = "courier_not_verified"

    @classmethod
    def default_message(cls) -> str:
        return "Tu perfil de repartidor todavía no ha sido aprobado."


class VehicleTypeNotEnabled(ValidationError):
    code = "vehicle_type_not_enabled"

    @classmethod
    def default_message(cls) -> str:
        return "Por ahora ese tipo de vehículo no está habilitado para repartir."


class InvalidPlate(ValidationError):
    code = "invalid_plate"

    @classmethod
    def default_message(cls) -> str:
        return "La placa no es válida."


class DeliveryNotFound(NotFoundError):
    code = "delivery_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Entrega no encontrada."


class NotDeliveryCourier(PermissionDeniedError):
    code = "not_delivery_courier"

    @classmethod
    def default_message(cls) -> str:
        return "No tienes permisos sobre esta entrega."


class NotOrderCustomer(PermissionDeniedError):
    code = "not_order_customer"

    @classmethod
    def default_message(cls) -> str:
        return "No tienes permisos sobre este pedido."


class NotStopStoreOwner(PermissionDeniedError):
    code = "not_stop_store_owner"

    @classmethod
    def default_message(cls) -> str:
        return "No tienes permisos sobre este punto de recogida."


class OrderNotClaimable(ValidationError):
    code = "order_not_claimable"

    @classmethod
    def default_message(cls) -> str:
        return "Este pedido no está disponible para repartir."


class OrderAlreadyClaimed(ValidationError):
    code = "order_already_claimed"

    @classmethod
    def default_message(cls) -> str:
        return "Otro repartidor ya tomó este pedido."


class StopNotFound(NotFoundError):
    code = "stop_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Ese punto de recogida no pertenece a esta entrega."


class PickupAlreadyConfirmed(ValidationError):
    code = "pickup_already_confirmed"

    @classmethod
    def default_message(cls) -> str:
        return "Ese punto de recogida ya fue confirmado."


class InvalidPickupCode(ValidationError):
    code = "invalid_pickup_code"

    @classmethod
    def default_message(cls) -> str:
        return "El código de recogida no es válido."


class InvalidDeliveryCode(ValidationError):
    code = "invalid_delivery_code"

    @classmethod
    def default_message(cls) -> str:
        return "El código de entrega no es válido."


class NotAllStopsPickedUp(ValidationError):
    code = "not_all_stops_picked_up"

    @classmethod
    def default_message(cls) -> str:
        return "Todavía te faltan puntos de recogida por confirmar."


class CannotCancelAfterPickup(ValidationError):
    code = "cannot_cancel_after_pickup"

    @classmethod
    def default_message(cls) -> str:
        return (
            "Ya recogiste pedidos en una tienda: no puedes cancelar, debes entregarlos al cliente."
        )


class StoreOrderNotReady(ValidationError):
    code = "store_order_not_ready"

    @classmethod
    def default_message(cls) -> str:
        return "El pedido todavía no está marcado como listo: márcalo listo antes de entregarlo."


class DeliveryAlreadyFinished(ValidationError):
    code = "delivery_already_finished"

    @classmethod
    def default_message(cls) -> str:
        return "Esta entrega ya se completó o se canceló."


class InvalidCourierRating(ValidationError):
    code = "invalid_courier_rating"

    @classmethod
    def default_message(cls) -> str:
        return "La calificación debe ser de 1 a 5 estrellas."


class DeliveryNotRateable(ValidationError):
    code = "delivery_not_rateable"

    @classmethod
    def default_message(cls) -> str:
        return "Solo puedes calificar al repartidor cuando tu pedido ya fue entregado."


class CourierAlreadyRated(ValidationError):
    code = "courier_already_rated"

    @classmethod
    def default_message(cls) -> str:
        return "Ya calificaste al repartidor de este pedido."


class InvalidLocation(ValidationError):
    code = "invalid_location"

    @classmethod
    def default_message(cls) -> str:
        return "La ubicación enviada no es válida."

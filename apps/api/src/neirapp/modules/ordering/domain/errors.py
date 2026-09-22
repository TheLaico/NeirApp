from neirapp.shared.domain.errors import NotFoundError, PermissionDeniedError, ValidationError


class OrderNotFound(NotFoundError):
    code = "order_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Pedido no encontrado."


class StoreOrderNotFound(NotFoundError):
    code = "store_order_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Pedido de tienda no encontrado."


class NotOrderOwner(PermissionDeniedError):
    code = "not_order_owner"

    @classmethod
    def default_message(cls) -> str:
        return "No tienes permisos sobre este pedido."


class NotStoreOrderOwner(PermissionDeniedError):
    code = "not_store_order_owner"

    @classmethod
    def default_message(cls) -> str:
        return "No tienes permisos sobre este pedido de tienda."


class InvalidQuantity(ValidationError):
    code = "invalid_quantity"

    @classmethod
    def default_message(cls) -> str:
        return "La cantidad debe ser mayor que cero."


class EmptyOrder(ValidationError):
    code = "empty_order"

    @classmethod
    def default_message(cls) -> str:
        return "El pedido no puede estar vacío."


class StoreUnavailableForOrder(ValidationError):
    code = "store_unavailable_for_order"

    @classmethod
    def default_message(cls) -> str:
        return "Esta tienda no está disponible para recibir pedidos en este momento."


class ProductUnavailableForOrder(ValidationError):
    code = "product_unavailable_for_order"

    @classmethod
    def default_message(cls) -> str:
        return "Uno de los productos ya no está disponible."


class InvalidStoreOrderTransition(ValidationError):
    code = "invalid_store_order_transition"

    @classmethod
    def default_message(cls) -> str:
        return "Ese cambio de estado no es válido desde el estado actual del pedido."


class OutsideServiceArea(ValidationError):
    code = "outside_service_area"

    @classmethod
    def default_message(cls) -> str:
        return "La dirección de entrega debe estar dentro del municipio de Neira."


class PaymentFailed(ValidationError):
    code = "payment_failed"

    @classmethod
    def default_message(cls) -> str:
        return "No pudimos procesar el pago. Intenta con otro método."


class OrderAlreadyPaid(ValidationError):
    code = "order_already_paid"

    @classmethod
    def default_message(cls) -> str:
        return "Este pedido ya fue pagado."

from neirapp.shared.domain.errors import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)


class InvalidRating(ValidationError):
    code = "invalid_rating"

    @classmethod
    def default_message(cls) -> str:
        return "La calificación debe ser un número entero entre 1 y 5."


class ReviewableStoreOrderNotFound(NotFoundError):
    code = "reviewable_store_order_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Ese pedido no existe."


class NotStoreOrderCustomer(PermissionDeniedError):
    code = "not_store_order_customer"

    @classmethod
    def default_message(cls) -> str:
        return "No puedes calificar un pedido que no es tuyo."


class StoreOrderNotCompleted(ValidationError):
    code = "store_order_not_completed"

    @classmethod
    def default_message(cls) -> str:
        return "Todavía no puedes calificar: la tienda no ha entregado este pedido."


class ReviewAlreadyExists(ConflictError):
    code = "review_already_exists"

    @classmethod
    def default_message(cls) -> str:
        return "Ya calificaste este pedido."


class InvalidReply(ValidationError):
    code = "invalid_reply"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe tu respuesta (entre 2 y 500 caracteres)."


class ReviewNotFound(NotFoundError):
    code = "review_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Reseña no encontrada."


class NotReviewedStoreOwner(PermissionDeniedError):
    code = "not_reviewed_store_owner"

    @classmethod
    def default_message(cls) -> str:
        return "Solo el dueño de la tienda puede responder esta reseña."

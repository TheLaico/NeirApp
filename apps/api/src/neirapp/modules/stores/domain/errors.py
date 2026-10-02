from neirapp.shared.domain.errors import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)


class StoreNotFound(NotFoundError):
    code = "store_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Tienda no encontrada."


class ProductNotFound(NotFoundError):
    code = "product_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Producto no encontrado."


class NotStoreOwner(PermissionDeniedError):
    code = "not_store_owner"

    @classmethod
    def default_message(cls) -> str:
        return "No tienes permisos sobre esta tienda."


class StoreOwnerNotRegistered(ValidationError):
    code = "store_owner_not_registered"

    @classmethod
    def default_message(cls) -> str:
        return "Ese correo todavía no tiene cuenta. Pídele a la persona que se registre primero."


class StoreOwnerNotMerchant(ValidationError):
    code = "store_owner_not_merchant"

    @classmethod
    def default_message(cls) -> str:
        return "Ese correo no tiene el rol de comerciante. Autorízalo primero en la sección Roles."


class OwnerAlreadyHasStore(ValidationError):
    code = "owner_already_has_store"

    @classmethod
    def default_message(cls) -> str:
        return "Ese comerciante ya tiene una tienda."


class InvalidSchedule(ValidationError):
    code = "invalid_schedule"

    @classmethod
    def default_message(cls) -> str:
        return "Horario no válido: cada día abierto necesita apertura anterior al cierre."


class InvalidClosedDate(ValidationError):
    code = "invalid_closed_date"

    @classmethod
    def default_message(cls) -> str:
        return "Fecha de cierre no válida: no puede ser pasada; el motivo admite 120 letras."


class InvalidImageUrl(ValidationError):
    code = "invalid_image_url"

    @classmethod
    def default_message(cls) -> str:
        return "La imagen debe subirse desde la app o ser un enlace https."


class OutsideServiceArea(ValidationError):
    code = "outside_service_area"

    @classmethod
    def default_message(cls) -> str:
        return "La ubicación debe estar dentro del municipio de Neira."


class InvalidStoreName(ValidationError):
    code = "invalid_store_name"

    @classmethod
    def default_message(cls) -> str:
        return "El nombre de la tienda debe tener entre 2 y 120 caracteres."


class InvalidProductName(ValidationError):
    code = "invalid_product_name"

    @classmethod
    def default_message(cls) -> str:
        return "El nombre del producto debe tener entre 2 y 120 caracteres."


class InvalidPrice(ValidationError):
    code = "invalid_price"

    @classmethod
    def default_message(cls) -> str:
        return "El precio debe ser mayor que cero."


class PhotoLimitReached(ValidationError):
    code = "photo_limit_reached"

    @classmethod
    def default_message(cls) -> str:
        return (
            "Tu tienda ya llegó al límite de 20 fotos (la de la tienda y las de tus productos). "
            "Si necesitas agregar más, comunícate con el desarrollador."
        )


class InvalidStorePosition(ValidationError):
    code = "invalid_store_position"

    @classmethod
    def default_message(cls) -> str:
        return "Para cambiar la posición envía la latitud y la longitud juntas."


class InvalidPromotionReference(ValidationError):
    code = "invalid_promotion_reference"

    @classmethod
    def default_message(cls) -> str:
        return "El comprobante puede tener hasta 120 caracteres."


class InvalidPromotionTransition(ConflictError):
    code = "invalid_promotion_transition"

    @classmethod
    def default_message(cls) -> str:
        return "Este pago ya fue revisado."


class PromotionPending(ConflictError):
    code = "promotion_pending"

    @classmethod
    def default_message(cls) -> str:
        return "Ya enviaste el pago para destacar este producto; estamos confirmándolo."


class PromotionNotFound(NotFoundError):
    code = "promotion_not_found"

    @classmethod
    def default_message(cls) -> str:
        return "Pago no encontrado."


class MissingPromotionNote(ValidationError):
    code = "missing_promotion_note"

    @classmethod
    def default_message(cls) -> str:
        return "Escribe el motivo."


class ProductNotPromotable(ValidationError):
    code = "product_not_promotable"

    @classmethod
    def default_message(cls) -> str:
        return "Solo se destacan productos disponibles, que se puedan agregar al carrito."

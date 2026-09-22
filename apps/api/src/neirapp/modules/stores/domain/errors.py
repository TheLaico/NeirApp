from neirapp.shared.domain.errors import NotFoundError, PermissionDeniedError, ValidationError


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

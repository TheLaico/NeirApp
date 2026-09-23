from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class ReviewableStoreOrderSnapshot:
    """Lo que `reviews` necesita saber de un `StoreOrder`, sin importar el módulo `ordering`."""

    store_order_id: UUID
    order_id: UUID
    store_id: UUID
    customer_id: UUID
    status: str  # espejo de StoreOrderStatus de `ordering`, como texto (ver CatalogPort)

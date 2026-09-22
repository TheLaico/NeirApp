from dataclasses import dataclass

from neirapp.modules.stores.domain.entities import Product, Store


@dataclass(frozen=True)
class ProductWithStore:
    """Resultado de una búsqueda: un producto necesita su tienda para mostrarse en un listado."""

    product: Product
    store: Store

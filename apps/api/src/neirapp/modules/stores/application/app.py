from dataclasses import dataclass

from neirapp.modules.stores.application.products import (
    CreateProduct,
    DeleteProduct,
    ListStoreProducts,
    SearchProducts,
    SetProductAvailability,
    UpdateProduct,
)
from neirapp.modules.stores.application.stores import (
    CreateStore,
    GetMyStore,
    GetStore,
    ListStores,
    SetStoreOpen,
    UpdateStore,
)


@dataclass(frozen=True)
class StoresApp:
    """Fachada del módulo: lo único que la capa de presentación necesita conocer."""

    create_store: CreateStore
    get_store: GetStore
    list_stores: ListStores
    update_store: UpdateStore
    set_store_open: SetStoreOpen
    get_my_store: GetMyStore

    create_product: CreateProduct
    list_store_products: ListStoreProducts
    update_product: UpdateProduct
    set_product_availability: SetProductAvailability
    delete_product: DeleteProduct
    search_products: SearchProducts

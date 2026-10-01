from dataclasses import dataclass

from neirapp.modules.stores.application.products import (
    CreateProduct,
    DeleteProduct,
    GetProductRaw,
    ListStoreProducts,
    SearchProducts,
    SetProductAvailability,
    UpdateProduct,
)
from neirapp.modules.stores.application.stores import (
    AddClosedDate,
    AdminCreateStore,
    AdminUpdateStore,
    ClearStoreHours,
    CreateStore,
    GetMyStore,
    GetStore,
    GetStoreRaw,
    ListStores,
    RemoveClosedDate,
    SetRecommendedStores,
    SetStoreApproval,
    SetStoreHours,
    SetStoreOpen,
    UpdateStore,
)
from neirapp.shared.application.ports import Clock


@dataclass(frozen=True)
class StoresApp:
    """Fachada del módulo: lo único que la capa de presentación necesita conocer."""

    create_store: CreateStore
    admin_create_store: AdminCreateStore
    get_store: GetStore
    list_stores: ListStores
    update_store: UpdateStore
    set_store_open: SetStoreOpen
    set_store_approval: SetStoreApproval
    set_recommended_stores: SetRecommendedStores
    admin_update_store: AdminUpdateStore
    get_my_store: GetMyStore
    get_store_raw: GetStoreRaw
    set_store_hours: SetStoreHours
    clear_store_hours: ClearStoreHours
    add_closed_date: AddClosedDate
    remove_closed_date: RemoveClosedDate
    # El estado abierto/cerrado depende de la hora: quien lo muestra necesita el mismo reloj.
    clock: Clock

    create_product: CreateProduct
    list_store_products: ListStoreProducts
    update_product: UpdateProduct
    set_product_availability: SetProductAvailability
    delete_product: DeleteProduct
    search_products: SearchProducts
    get_product_raw: GetProductRaw

from dataclasses import dataclass

from neirapp.modules.suppliers.application.use_cases import (
    GetMySupplier,
    GetSupplier,
    ListSuppliers,
    SaveMySupplier,
)


@dataclass(frozen=True)
class SuppliersApp:
    """Fachada del módulo Proveedores (empresas que venden al por mayor)."""

    get_my_supplier: GetMySupplier
    save_my_supplier: SaveMySupplier
    list_suppliers: ListSuppliers
    get_supplier: GetSupplier

from typing import Annotated

from fastapi import Depends, Request

from neirapp.modules.suppliers.application.app import SuppliersApp


def get_suppliers(request: Request) -> SuppliersApp:
    suppliers: SuppliersApp = request.app.state.suppliers
    return suppliers


SuppliersDep = Annotated[SuppliersApp, Depends(get_suppliers)]

from typing import Annotated

from fastapi import Depends, Request

from neirapp.modules.stores.application.app import StoresApp


def get_stores(request: Request) -> StoresApp:
    stores: StoresApp = request.app.state.stores
    return stores


StoresDep = Annotated[StoresApp, Depends(get_stores)]

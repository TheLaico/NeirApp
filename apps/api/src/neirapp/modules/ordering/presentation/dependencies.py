from typing import Annotated

from fastapi import Depends, Request

from neirapp.modules.ordering.application.app import OrderingApp


def get_ordering(request: Request) -> OrderingApp:
    ordering: OrderingApp = request.app.state.ordering
    return ordering


OrderingDep = Annotated[OrderingApp, Depends(get_ordering)]

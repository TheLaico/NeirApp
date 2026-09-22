from typing import Annotated

from fastapi import Depends, Request

from neirapp.modules.dispatch.application.app import DispatchApp


def get_dispatch(request: Request) -> DispatchApp:
    dispatch: DispatchApp = request.app.state.dispatch
    return dispatch


DispatchDep = Annotated[DispatchApp, Depends(get_dispatch)]

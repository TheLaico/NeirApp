from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from neirapp.modules.identity.application.app import IdentityApp
from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.domain.errors import InsufficientRole, InvalidToken

_bearer = HTTPBearer(auto_error=False, description="Access token JWT")


def get_identity(request: Request) -> IdentityApp:
    identity: IdentityApp = request.app.state.identity
    return identity


def client_ip(request: Request) -> str | None:
    """IP del cliente. Detrás de un proxy, uvicorn debe correr con `--proxy-headers`."""
    return request.client.host if request.client else None


IdentityDep = Annotated[IdentityApp, Depends(get_identity)]
ClientIpDep = Annotated[str | None, Depends(client_ip)]


async def current_user(
    identity: IdentityDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise InvalidToken()
    return await identity.authenticate(credentials.credentials)


CurrentUser = Annotated[User, Depends(current_user)]


def require_roles(*roles: Role) -> Callable[[User], Awaitable[User]]:
    """Dependencia que exige que el usuario tenga al menos uno de los roles dados."""

    async def dependency(user: CurrentUser) -> User:
        if not user.has_any_role(*roles):
            raise InsufficientRole()
        return user

    return dependency

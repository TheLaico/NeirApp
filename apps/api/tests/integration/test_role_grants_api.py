from typing import Any
from uuid import UUID

import httpx
from fastapi import FastAPI

from neirapp.modules.identity.domain.entities import Role
from neirapp.modules.identity.infrastructure.models import UserRoleModel
from tests.integration.test_identity_api import API, bearer, register

GRANTS = f"{API}/admin/role-grants"


async def _admin(client: httpx.AsyncClient, app: FastAPI) -> dict[str, Any]:
    tokens = (await register(client, email="admin@correo.com")).json()["tokens"]
    me = (await client.get(f"{API}/me", headers=bearer(tokens))).json()
    async with app.state.engine.begin() as conn:
        await conn.execute(
            UserRoleModel.__table__.insert().values(user_id=UUID(me["id"]), role=Role.ADMIN.value)
        )
    return tokens


async def _roles_of(client: httpx.AsyncClient, email: str, password: str) -> list[str]:
    login = await client.post(f"{API}/login", json={"email": email, "password": password})
    return login.json()["user"]["roles"]  # type: ignore[no-any-return]


async def test_solo_admin_puede_gestionar(client: httpx.AsyncClient) -> None:
    tokens = (await register(client, email="cliente@correo.com")).json()["tokens"]

    listing = await client.get(GRANTS, headers=bearer(tokens))
    create = await client.post(
        GRANTS, json={"email": "x@correo.com", "role": "courier"}, headers=bearer(tokens)
    )

    assert listing.status_code == 403
    assert create.status_code == 403
    assert (await client.get(GRANTS)).status_code == 401


async def test_correo_pendiente_recibe_el_rol_al_registrarse(
    client: httpx.AsyncClient, app: FastAPI
) -> None:
    admin = await _admin(client, app)

    created = await client.post(
        GRANTS,
        json={"email": "  Repartidor@Correo.com ", "role": "courier"},
        headers=bearer(admin),
    )
    assert created.status_code == 201
    assert created.json()["email"] == "repartidor@correo.com"
    assert created.json()["has_account"] is False

    registered = await register(client, email="repartidor@correo.com")
    assert sorted(registered.json()["user"]["roles"]) == ["courier", "customer"]


async def test_usuario_existente_recibe_el_rol_al_instante_y_se_le_puede_quitar(
    client: httpx.AsyncClient, app: FastAPI
) -> None:
    admin = await _admin(client, app)
    await register(client, email="tienda@correo.com")

    created = await client.post(
        GRANTS, json={"email": "tienda@correo.com", "role": "store_staff"}, headers=bearer(admin)
    )
    assert created.json()["has_account"] is True
    assert created.json()["full_name"] == "Ana Gómez"
    assert "store_staff" in await _roles_of(client, "tienda@correo.com", "clave-segura-123")

    revoked = await client.delete(
        GRANTS,
        params={"email": "tienda@correo.com", "role": "store_staff"},
        headers=bearer(admin),
    )
    assert revoked.status_code == 204
    assert await _roles_of(client, "tienda@correo.com", "clave-segura-123") == ["customer"]
    assert (await client.get(GRANTS, headers=bearer(admin))).json() == []


async def test_autorizar_dos_veces_es_idempotente(client: httpx.AsyncClient, app: FastAPI) -> None:
    admin = await _admin(client, app)
    body = {"email": "dos@correo.com", "role": "courier"}

    await client.post(GRANTS, json=body, headers=bearer(admin))
    again = await client.post(GRANTS, json=body, headers=bearer(admin))

    assert again.status_code == 201
    assert len((await client.get(GRANTS, headers=bearer(admin))).json()) == 1


async def test_no_se_puede_autorizar_admin_ni_cliente_ni_correo_invalido(
    client: httpx.AsyncClient, app: FastAPI
) -> None:
    admin = await _admin(client, app)

    for role in ("admin", "customer"):
        response = await client.post(
            GRANTS, json={"email": "a@correo.com", "role": role}, headers=bearer(admin)
        )
        assert response.status_code == 422
        assert response.json()["code"] == "role_not_assignable"

    bad = await client.post(
        GRANTS, json={"email": "no-es-correo", "role": "courier"}, headers=bearer(admin)
    )
    assert bad.status_code == 422

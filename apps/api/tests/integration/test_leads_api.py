from typing import Any
from uuid import UUID

import httpx
from fastapi import FastAPI

from neirapp.modules.identity.domain.entities import Role
from neirapp.modules.identity.infrastructure.models import UserRoleModel

API = "/api/v1"
BODY = {
    "contact_name": "Ana Gómez",
    "business_name": "Panadería La Espiga",
    "phone": "300 123 4567",
}


async def _register(client: httpx.AsyncClient, email: str) -> dict[str, Any]:
    response = await client.post(
        f"{API}/identity/register",
        json={
            "email": email,
            "password": "clave-segura-123",
            "full_name": "Ana Gómez",
            "phone": "300 123 4567",
            "accepted_terms": True,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["tokens"]  # type: ignore[no-any-return]


def _bearer(tokens: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def _admin(client: httpx.AsyncClient, app: FastAPI) -> dict[str, Any]:
    tokens = await _register(client, "admin@correo.com")
    me = (await client.get(f"{API}/identity/me", headers=_bearer(tokens))).json()
    async with app.state.engine.begin() as conn:
        await conn.execute(
            UserRoleModel.__table__.insert().values(  # type: ignore[attr-defined]
                user_id=UUID(me["id"]), role=Role.ADMIN.value
            )
        )
    return tokens


class TestMerchantLeads:
    async def test_un_usuario_deja_su_informacion(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client, "cliente@correo.com")
        response = await client.post(f"{API}/leads/merchants", json=BODY, headers=_bearer(tokens))
        assert response.status_code == 201, response.text
        assert response.json()["business_name"] == "Panadería La Espiga"
        assert response.json()["is_contacted"] is False

    async def test_requiere_sesion(self, client: httpx.AsyncClient) -> None:
        response = await client.post(f"{API}/leads/merchants", json=BODY)
        assert response.status_code == 401

    async def test_datos_invalidos(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client, "cliente@correo.com")
        for change, code in (
            ({"contact_name": " "}, "invalid_contact_name"),
            ({"business_name": "x"}, "invalid_business_name"),
            ({"phone": "123"}, "invalid_contact_phone"),
        ):
            response = await client.post(
                f"{API}/leads/merchants", json={**BODY, **change}, headers=_bearer(tokens)
            )
            assert response.status_code == 422
            assert response.json()["code"] == code

    async def test_solo_el_admin_ve_la_lista_y_la_marca_como_contactada(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        customer = await _register(client, "cliente@correo.com")
        created = await client.post(f"{API}/leads/merchants", json=BODY, headers=_bearer(customer))
        lead_id = created.json()["id"]

        forbidden = await client.get(f"{API}/leads/merchants", headers=_bearer(customer))
        assert forbidden.status_code == 403

        admin = await _admin(client, app)
        listing = await client.get(f"{API}/leads/merchants", headers=_bearer(admin))
        assert [lead["id"] for lead in listing.json()] == [lead_id]

        marked = await client.patch(
            f"{API}/leads/merchants/{lead_id}", json={"is_contacted": True}, headers=_bearer(admin)
        )
        assert marked.status_code == 200
        assert marked.json()["is_contacted"] is True

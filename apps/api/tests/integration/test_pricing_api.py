from typing import Any
from uuid import UUID

import httpx
from fastapi import FastAPI

from neirapp.modules.identity.domain.entities import Role
from neirapp.modules.identity.infrastructure.models import UserRoleModel

API = "/api/v1"


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
            UserRoleModel.__table__.insert().values(user_id=UUID(me["id"]), role=Role.ADMIN.value)
        )
    return tokens


class TestDeliveryPricing:
    async def test_tarifa_por_defecto_es_publica(self, client: httpx.AsyncClient) -> None:
        response = await client.get(f"{API}/pricing/delivery")
        assert response.status_code == 200
        assert response.json() == {
            "delivery_fee_cop": 5_000,
            "courier_share_percent": 80,
            "platform_share_percent": 20,
            "courier_cop": 4_000,
            "platform_cop": 1_000,
        }

    async def test_el_admin_la_cambia_y_queda_guardada(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        updated = await client.put(
            f"{API}/pricing/delivery",
            json={"delivery_fee_cop": 6_000, "courier_share_percent": 70},
            headers=_bearer(admin),
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["courier_cop"] == 4_200
        assert updated.json()["platform_cop"] == 1_800

        current = await client.get(f"{API}/pricing/delivery")
        assert current.json()["delivery_fee_cop"] == 6_000
        assert current.json()["platform_share_percent"] == 30

    async def test_un_no_admin_no_puede_cambiarla(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client, "cliente@correo.com")
        response = await client.put(
            f"{API}/pricing/delivery",
            json={"delivery_fee_cop": 1_000, "courier_share_percent": 50},
            headers=_bearer(tokens),
        )
        assert response.status_code == 403

    async def test_valores_invalidos_se_rechazan(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin = await _admin(client, app)
        for body in (
            {"delivery_fee_cop": -1, "courier_share_percent": 50},
            {"delivery_fee_cop": 5_000, "courier_share_percent": 101},
        ):
            response = await client.put(
                f"{API}/pricing/delivery", json=body, headers=_bearer(admin)
            )
            assert response.status_code == 422

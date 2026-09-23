from typing import Any
from uuid import UUID, uuid4

import httpx
from fastapi import FastAPI

from neirapp.modules.identity.domain.entities import Role
from neirapp.modules.identity.infrastructure.models import UserRoleModel

API = "/api/v1"

NEIRA_LAT, NEIRA_LNG = 5.1667, -75.5167

STORE_BODY = {
    "name": "Pizzería Napoli",
    "category": "restaurant",
    "description": "",
    "lat": NEIRA_LAT,
    "lng": NEIRA_LNG,
}
PRODUCT_BODY = {"name": "Pizza margarita", "description": "", "price_cop": 25_000}
COURIER_BODY = {"vehicle_type": "motorcycle", "plate": "ABC123", "id_document_number": "123456789"}


async def _register(client: httpx.AsyncClient, email: str = "ana@correo.com") -> dict[str, Any]:
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


_admin_seq = 0


async def _admin_tokens(client: httpx.AsyncClient, app: FastAPI) -> dict[str, Any]:
    global _admin_seq
    _admin_seq += 1
    tokens = await _register(client, f"admin{_admin_seq}@correo.com")
    me = (await client.get(f"{API}/identity/me", headers=_bearer(tokens))).json()
    async with app.state.engine.begin() as conn:
        await conn.execute(
            UserRoleModel.__table__.insert().values(user_id=UUID(me["id"]), role=Role.ADMIN.value)
        )
    return tokens


async def _create_approved_store(
    client: httpx.AsyncClient, app: FastAPI, tokens: dict[str, Any]
) -> dict[str, Any]:
    response = await client.post(f"{API}/stores", json=STORE_BODY, headers=_bearer(tokens))
    assert response.status_code == 201, response.text
    store = response.json()
    admin = await _admin_tokens(client, app)
    approve = await client.patch(
        f"{API}/stores/{store['id']}/approval", json={"is_approved": True}, headers=_bearer(admin)
    )
    assert approve.status_code == 200, approve.text
    return store  # type: ignore[no-any-return]


async def _paid_order_with_claimed_delivery(
    client: httpx.AsyncClient, app: FastAPI
) -> tuple[str, dict[str, Any], dict[str, Any]]:
    """Crea un pedido, lo paga, lo lleva a `ready` y lo reclama un repartidor verificado.
    Devuelve (order_id, customer_tokens, courier_tokens)."""
    owner = await _register(client, "duena@correo.com")
    store = await _create_approved_store(client, app, owner)
    product = (
        await client.post(
            f"{API}/stores/{store['id']}/products", json=PRODUCT_BODY, headers=_bearer(owner)
        )
    ).json()
    customer = await _register(client, "cliente@correo.com")

    created = (
        await client.post(
            f"{API}/orders",
            json={
                "delivery_lat": NEIRA_LAT,
                "delivery_lng": NEIRA_LNG,
                "delivery_notes": "",
                "items": [{"store_id": store["id"], "product_id": product["id"], "quantity": 1}],
            },
            headers=_bearer(customer),
        )
    ).json()
    paid = (
        await client.post(f"{API}/orders/{created['id']}/pay", headers=_bearer(customer))
    ).json()
    store_order_id = paid["store_orders"][0]["id"]
    await client.post(f"{API}/store-orders/{store_order_id}/accept", headers=_bearer(owner))
    await client.post(f"{API}/store-orders/{store_order_id}/preparing", headers=_bearer(owner))
    await client.post(f"{API}/store-orders/{store_order_id}/ready", headers=_bearer(owner))

    courier = await _register(client, "repartidor@correo.com")
    profile = (
        await client.post(f"{API}/couriers/me", json=COURIER_BODY, headers=_bearer(courier))
    ).json()
    admin = await _admin_tokens(client, app)
    await client.patch(
        f"{API}/couriers/{profile['id']}/verification",
        json={"is_verified": True},
        headers=_bearer(admin),
    )
    await client.post(f"{API}/deliveries/{created['id']}/claim", headers=_bearer(courier))
    return created["id"], customer, courier


class TestReportIncident:
    async def test_el_cliente_reporta_un_problema(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order_id, customer, _courier = await _paid_order_with_claimed_delivery(client, app)
        response = await client.post(
            f"{API}/incidents",
            json={
                "order_id": order_id,
                "category": "wrong_item",
                "description": "Me llegó una pizza distinta a la que pedí",
            },
            headers=_bearer(customer),
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["reporter_role"] == "customer"
        assert body["status"] == "open"

    async def test_el_repartidor_reporta_un_problema(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order_id, _customer, courier = await _paid_order_with_claimed_delivery(client, app)
        response = await client.post(
            f"{API}/incidents",
            json={
                "order_id": order_id,
                "category": "late_delivery",
                "description": "Tráfico pesado",
            },
            headers=_bearer(courier),
        )
        assert response.status_code == 201, response.text
        assert response.json()["reporter_role"] == "courier"

    async def test_usuario_ajeno_no_puede_reportar(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order_id, _customer, _courier = await _paid_order_with_claimed_delivery(client, app)
        other = await _register(client, "otro@correo.com")
        response = await client.post(
            f"{API}/incidents",
            json={"order_id": order_id, "category": "other", "description": "Algo pasó"},
            headers=_bearer(other),
        )
        assert response.status_code == 403
        assert response.json()["code"] == "not_authorized_to_report"

    async def test_descripcion_vacia_la_rechaza_el_request(self, client: httpx.AsyncClient) -> None:
        customer = await _register(client)
        response = await client.post(
            f"{API}/incidents",
            json={"order_id": str(uuid4()), "category": "other", "description": ""},
            headers=_bearer(customer),
        )
        assert response.status_code == 422


class TestListMyIncidents:
    async def test_lista_solo_mis_reportes(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        order_id, customer, courier = await _paid_order_with_claimed_delivery(client, app)
        await client.post(
            f"{API}/incidents",
            json={"order_id": order_id, "category": "wrong_item", "description": "Item incorrecto"},
            headers=_bearer(customer),
        )
        await client.post(
            f"{API}/incidents",
            json={"order_id": order_id, "category": "late_delivery", "description": "Se demoró"},
            headers=_bearer(courier),
        )

        mine = await client.get(f"{API}/incidents/mine", headers=_bearer(customer))
        assert len(mine.json()) == 1
        assert mine.json()[0]["reporter_role"] == "customer"


class TestAdminResolve:
    async def test_solo_admin_lista_todos(self, client: httpx.AsyncClient) -> None:
        customer = await _register(client)
        response = await client.get(f"{API}/incidents", headers=_bearer(customer))
        assert response.status_code == 403

    async def test_admin_lista_y_filtra_por_estado(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order_id, customer, _courier = await _paid_order_with_claimed_delivery(client, app)
        created = (
            await client.post(
                f"{API}/incidents",
                json={
                    "order_id": order_id,
                    "category": "damaged",
                    "description": "Llegó dañado",
                },
                headers=_bearer(customer),
            )
        ).json()
        admin = await _admin_tokens(client, app)

        open_incidents = await client.get(
            f"{API}/incidents", params={"status": "open"}, headers=_bearer(admin)
        )
        assert [i["id"] for i in open_incidents.json()] == [created["id"]]

        resolved_incidents = await client.get(
            f"{API}/incidents", params={"status": "resolved"}, headers=_bearer(admin)
        )
        assert resolved_incidents.json() == []

    async def test_admin_resuelve_un_reporte(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        order_id, customer, _courier = await _paid_order_with_claimed_delivery(client, app)
        created = (
            await client.post(
                f"{API}/incidents",
                json={
                    "order_id": order_id,
                    "category": "missing_item",
                    "description": "Faltó algo",
                },
                headers=_bearer(customer),
            )
        ).json()
        admin = await _admin_tokens(client, app)

        response = await client.patch(
            f"{API}/incidents/{created['id']}/resolve",
            json={"status": "resolved", "resolution_note": "Se reembolsó al cliente"},
            headers=_bearer(admin),
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["status"] == "resolved"
        assert body["resolution_note"] == "Se reembolsó al cliente"
        assert body["resolved_at"] is not None

    async def test_no_se_puede_resolver_dos_veces(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order_id, customer, _courier = await _paid_order_with_claimed_delivery(client, app)
        created = (
            await client.post(
                f"{API}/incidents",
                json={"order_id": order_id, "category": "other", "description": "Algo raro"},
                headers=_bearer(customer),
            )
        ).json()
        admin = await _admin_tokens(client, app)
        await client.patch(
            f"{API}/incidents/{created['id']}/resolve",
            json={"status": "dismissed", "resolution_note": None},
            headers=_bearer(admin),
        )
        response = await client.patch(
            f"{API}/incidents/{created['id']}/resolve",
            json={"status": "resolved", "resolution_note": None},
            headers=_bearer(admin),
        )
        assert response.status_code == 422
        assert response.json()["code"] == "incident_already_resolved"

    async def test_reporte_inexistente(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        admin = await _admin_tokens(client, app)
        response = await client.patch(
            f"{API}/incidents/{uuid4()}/resolve",
            json={"status": "resolved", "resolution_note": None},
            headers=_bearer(admin),
        )
        assert response.status_code == 404
        assert response.json()["code"] == "incident_not_found"

    async def test_no_admin_no_puede_resolver(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order_id, customer, _courier = await _paid_order_with_claimed_delivery(client, app)
        created = (
            await client.post(
                f"{API}/incidents",
                json={"order_id": order_id, "category": "other", "description": "Algo raro"},
                headers=_bearer(customer),
            )
        ).json()
        response = await client.patch(
            f"{API}/incidents/{created['id']}/resolve",
            json={"status": "resolved", "resolution_note": None},
            headers=_bearer(customer),
        )
        assert response.status_code == 403

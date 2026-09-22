from typing import Any
from uuid import UUID, uuid4

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from neirapp.modules.identity.domain.entities import Role
from neirapp.modules.identity.infrastructure.models import UserRoleModel

API = "/api/v1"

NEIRA_LAT, NEIRA_LNG = 5.1667, -75.5167
OUTSIDE_LAT, OUTSIDE_LNG = 5.0689, -75.5174  # Manizales: fuera de Neira

STORE_BODY = {
    "name": "Pizzería Napoli",
    "category": "restaurant",
    "description": "",
    "lat": NEIRA_LAT,
    "lng": NEIRA_LNG,
}
PRODUCT_BODY = {"name": "Pizza margarita", "description": "", "price_cop": 25_000}


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
    client: httpx.AsyncClient, app: FastAPI, tokens: dict[str, Any], **overrides: Any
) -> dict[str, Any]:
    response = await client.post(
        f"{API}/stores", json={**STORE_BODY, **overrides}, headers=_bearer(tokens)
    )
    assert response.status_code == 201, response.text
    store = response.json()
    admin = await _admin_tokens(client, app)
    approve = await client.patch(
        f"{API}/stores/{store['id']}/approval", json={"is_approved": True}, headers=_bearer(admin)
    )
    assert approve.status_code == 200, approve.text
    return store  # type: ignore[no-any-return]


async def _create_product(
    client: httpx.AsyncClient, tokens: dict[str, Any], store_id: str, **overrides: Any
) -> dict[str, Any]:
    response = await client.post(
        f"{API}/stores/{store_id}/products",
        json={**PRODUCT_BODY, **overrides},
        headers=_bearer(tokens),
    )
    assert response.status_code == 201, response.text
    return response.json()  # type: ignore[no-any-return]


async def _store_with_product(
    client: httpx.AsyncClient, app: FastAPI, email: str = "duena@correo.com"
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    """Devuelve (store, product, owner_tokens)."""
    owner_tokens = await _register(client, email)
    store = await _create_approved_store(client, app, owner_tokens)
    product = await _create_product(client, owner_tokens, store["id"])
    return store, product, owner_tokens


def _order_body(
    store_id: str, product_id: str, quantity: int = 2, **overrides: Any
) -> dict[str, Any]:
    return {
        "delivery_lat": NEIRA_LAT,
        "delivery_lng": NEIRA_LNG,
        "delivery_notes": "Casa azul, segundo piso",
        "items": [{"store_id": store_id, "product_id": product_id, "quantity": quantity}],
        **overrides,
    }


class TestCreateOrder:
    async def test_crea_un_pedido_de_una_tienda(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, product, _ = await _store_with_product(client, app)
        customer = await _register(client, "cliente@correo.com")

        response = await client.post(
            f"{API}/orders",
            json=_order_body(store["id"], product["id"], quantity=2),
            headers=_bearer(customer),
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert len(body["store_orders"]) == 1
        store_order = body["store_orders"][0]
        assert store_order["status"] == "pending_payment"
        assert store_order["subtotal_cop"] == 50_000
        assert body["total_cop"] == 50_000
        assert store_order["lines"][0]["name"] == "Pizza margarita"

    async def test_pedido_multi_tienda(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        store_a, product_a, _ = await _store_with_product(client, app, "duena1@correo.com")
        store_b, _product_b, owner_b_tokens = await _store_with_product(
            client, app, "duena2@correo.com"
        )
        # la segunda tienda vende algo distinto, más barato
        panaderia_product = await _create_product(
            client, owner_b_tokens, store_b["id"], name="Pan de queso", price_cop=3_000
        )
        customer = await _register(client, "cliente@correo.com")

        response = await client.post(
            f"{API}/orders",
            json={
                "delivery_lat": NEIRA_LAT,
                "delivery_lng": NEIRA_LNG,
                "delivery_notes": "",
                "items": [
                    {"store_id": store_a["id"], "product_id": product_a["id"], "quantity": 1},
                    {
                        "store_id": store_b["id"],
                        "product_id": panaderia_product["id"],
                        "quantity": 2,
                    },
                ],
            },
            headers=_bearer(customer),
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert len(body["store_orders"]) == 2
        assert body["total_cop"] == 25_000 + 6_000
        assert {so["store_id"] for so in body["store_orders"]} == {store_a["id"], store_b["id"]}

    async def test_requiere_autenticacion(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        store, product, _ = await _store_with_product(client, app)
        response = await client.post(f"{API}/orders", json=_order_body(store["id"], product["id"]))
        assert response.status_code == 401

    async def test_carrito_vacio(self, client: httpx.AsyncClient) -> None:
        customer = await _register(client)
        response = await client.post(
            f"{API}/orders",
            json={
                "delivery_lat": NEIRA_LAT,
                "delivery_lng": NEIRA_LNG,
                "delivery_notes": "",
                "items": [],
            },
            headers=_bearer(customer),
        )
        assert response.status_code == 422

    async def test_entrega_fuera_de_neira(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        store, product, _ = await _store_with_product(client, app)
        customer = await _register(client, "cliente@correo.com")
        response = await client.post(
            f"{API}/orders",
            json=_order_body(
                store["id"], product["id"], delivery_lat=OUTSIDE_LAT, delivery_lng=OUTSIDE_LNG
            ),
            headers=_bearer(customer),
        )
        assert response.status_code == 422
        assert response.json()["code"] == "outside_service_area"

    async def test_tienda_no_aprobada(self, client: httpx.AsyncClient) -> None:
        owner = await _register(client, "duena@correo.com")
        store_resp = await client.post(f"{API}/stores", json=STORE_BODY, headers=_bearer(owner))
        store = store_resp.json()
        product = await _create_product(client, owner, store["id"])
        customer = await _register(client, "cliente@correo.com")

        response = await client.post(
            f"{API}/orders", json=_order_body(store["id"], product["id"]), headers=_bearer(customer)
        )
        assert response.status_code == 422
        assert response.json()["code"] == "store_unavailable_for_order"

    async def test_tienda_cerrada(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        store, product, owner = await _store_with_product(client, app)
        await client.patch(
            f"{API}/stores/{store['id']}/open", json={"is_open": False}, headers=_bearer(owner)
        )
        customer = await _register(client, "cliente@correo.com")

        response = await client.post(
            f"{API}/orders", json=_order_body(store["id"], product["id"]), headers=_bearer(customer)
        )
        assert response.status_code == 422
        assert response.json()["code"] == "store_unavailable_for_order"

    async def test_producto_no_disponible(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        store, product, owner = await _store_with_product(client, app)
        await client.patch(
            f"{API}/stores/{store['id']}/products/{product['id']}/availability",
            json={"is_available": False},
            headers=_bearer(owner),
        )
        customer = await _register(client, "cliente@correo.com")

        response = await client.post(
            f"{API}/orders", json=_order_body(store["id"], product["id"]), headers=_bearer(customer)
        )
        assert response.status_code == 422
        assert response.json()["code"] == "product_unavailable_for_order"

    async def test_producto_inexistente(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        store, _product, _ = await _store_with_product(client, app)
        customer = await _register(client, "cliente@correo.com")

        response = await client.post(
            f"{API}/orders",
            json=_order_body(store["id"], str(uuid4())),
            headers=_bearer(customer),
        )
        assert response.status_code == 422
        assert response.json()["code"] == "product_unavailable_for_order"

    async def test_cantidad_invalida_la_rechaza_el_request(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, product, _ = await _store_with_product(client, app)
        customer = await _register(client, "cliente@correo.com")
        response = await client.post(
            f"{API}/orders",
            json=_order_body(store["id"], product["id"], quantity=0),
            headers=_bearer(customer),
        )
        assert response.status_code == 422

    async def test_el_precio_se_lee_del_catalogo_no_del_cliente(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        """El request no tiene ningún campo de precio: es estructuralmente imposible mandar uno,
        pero además confirmamos que el snapshot usa el precio vigente al momento del pedido."""
        store, product, owner = await _store_with_product(client, app)
        customer = await _register(client, "cliente@correo.com")

        first = await client.post(
            f"{API}/orders",
            json=_order_body(store["id"], product["id"], quantity=1),
            headers=_bearer(customer),
        )
        assert first.json()["store_orders"][0]["lines"][0]["price_cop"] == 25_000

        await client.patch(
            f"{API}/stores/{store['id']}/products/{product['id']}",
            json={"price_cop": 40_000},
            headers=_bearer(owner),
        )

        second = await client.post(
            f"{API}/orders",
            json=_order_body(store["id"], product["id"], quantity=1),
            headers=_bearer(customer),
        )
        assert second.json()["store_orders"][0]["lines"][0]["price_cop"] == 40_000
        # el pedido viejo no cambia retroactivamente
        old = await client.get(f"{API}/orders/{first.json()['id']}", headers=_bearer(customer))
        assert old.json()["store_orders"][0]["lines"][0]["price_cop"] == 25_000


class TestGetAndListOrders:
    async def test_el_cliente_ve_su_pedido(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        store, product, _ = await _store_with_product(client, app)
        customer = await _register(client, "cliente@correo.com")
        created = (
            await client.post(
                f"{API}/orders",
                json=_order_body(store["id"], product["id"]),
                headers=_bearer(customer),
            )
        ).json()

        response = await client.get(f"{API}/orders/{created['id']}", headers=_bearer(customer))
        assert response.status_code == 200
        assert response.json()["id"] == created["id"]

    async def test_otro_usuario_no_puede_ver_el_pedido(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, product, _ = await _store_with_product(client, app)
        customer = await _register(client, "cliente@correo.com")
        created = (
            await client.post(
                f"{API}/orders",
                json=_order_body(store["id"], product["id"]),
                headers=_bearer(customer),
            )
        ).json()
        other = await _register(client, "otro@correo.com")

        response = await client.get(f"{API}/orders/{created['id']}", headers=_bearer(other))
        assert response.status_code == 403

    async def test_lista_mis_pedidos(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        store, product, _ = await _store_with_product(client, app)
        customer = await _register(client, "cliente@correo.com")
        await client.post(
            f"{API}/orders", json=_order_body(store["id"], product["id"]), headers=_bearer(customer)
        )
        await client.post(
            f"{API}/orders", json=_order_body(store["id"], product["id"]), headers=_bearer(customer)
        )

        response = await client.get(f"{API}/orders", headers=_bearer(customer))
        assert response.status_code == 200
        assert len(response.json()) == 2


class TestPayOrder:
    async def test_pagar_marca_todos_los_store_orders_como_pagados(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, product, _ = await _store_with_product(client, app)
        customer = await _register(client, "cliente@correo.com")
        created = (
            await client.post(
                f"{API}/orders",
                json=_order_body(store["id"], product["id"]),
                headers=_bearer(customer),
            )
        ).json()

        response = await client.post(f"{API}/orders/{created['id']}/pay", headers=_bearer(customer))
        assert response.status_code == 200
        assert all(so["status"] == "paid" for so in response.json()["store_orders"])

    async def test_no_se_puede_pagar_dos_veces(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, product, _ = await _store_with_product(client, app)
        customer = await _register(client, "cliente@correo.com")
        created = (
            await client.post(
                f"{API}/orders",
                json=_order_body(store["id"], product["id"]),
                headers=_bearer(customer),
            )
        ).json()
        await client.post(f"{API}/orders/{created['id']}/pay", headers=_bearer(customer))

        response = await client.post(f"{API}/orders/{created['id']}/pay", headers=_bearer(customer))
        assert response.status_code == 422
        assert response.json()["code"] == "order_already_paid"

    async def test_otro_usuario_no_puede_pagar(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, product, _ = await _store_with_product(client, app)
        customer = await _register(client, "cliente@correo.com")
        created = (
            await client.post(
                f"{API}/orders",
                json=_order_body(store["id"], product["id"]),
                headers=_bearer(customer),
            )
        ).json()
        other = await _register(client, "otro@correo.com")

        response = await client.post(f"{API}/orders/{created['id']}/pay", headers=_bearer(other))
        assert response.status_code == 403

    async def test_pedido_inexistente(self, client: httpx.AsyncClient) -> None:
        customer = await _register(client)
        response = await client.post(f"{API}/orders/{uuid4()}/pay", headers=_bearer(customer))
        assert response.status_code == 404


class TestStoreOrderActions:
    async def _paid_store_order(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """Crea, paga un pedido y devuelve (store_order, owner_tokens)."""
        store, product, owner = await _store_with_product(client, app)
        customer = await _register(client, "cliente@correo.com")
        created = (
            await client.post(
                f"{API}/orders",
                json=_order_body(store["id"], product["id"]),
                headers=_bearer(customer),
            )
        ).json()
        paid = (
            await client.post(f"{API}/orders/{created['id']}/pay", headers=_bearer(customer))
        ).json()
        return paid["store_orders"][0], owner

    async def test_el_dueno_ve_sus_pedidos(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        store_order, owner = await self._paid_store_order(client, app)
        response = await client.get(
            f"{API}/stores/{store_order['store_id']}/orders", headers=_bearer(owner)
        )
        assert response.status_code == 200
        assert [so["id"] for so in response.json()] == [store_order["id"]]

    async def test_filtra_por_estado(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        store_order, owner = await self._paid_store_order(client, app)
        paid = await client.get(
            f"{API}/stores/{store_order['store_id']}/orders",
            params={"status": "paid"},
            headers=_bearer(owner),
        )
        ready = await client.get(
            f"{API}/stores/{store_order['store_id']}/orders",
            params={"status": "ready"},
            headers=_bearer(owner),
        )
        assert len(paid.json()) == 1
        assert ready.json() == []

    async def test_otro_usuario_no_ve_los_pedidos_de_la_tienda(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store_order, _owner = await self._paid_store_order(client, app)
        other = await _register(client, "otro@correo.com")
        response = await client.get(
            f"{API}/stores/{store_order['store_id']}/orders", headers=_bearer(other)
        )
        assert response.status_code == 403

    async def test_flujo_completo_aceptar_preparar_listo(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store_order, owner = await self._paid_store_order(client, app)
        sid = store_order["id"]

        accepted = await client.post(f"{API}/store-orders/{sid}/accept", headers=_bearer(owner))
        assert accepted.json()["status"] == "accepted"

        preparing = await client.post(f"{API}/store-orders/{sid}/preparing", headers=_bearer(owner))
        assert preparing.json()["status"] == "preparing"

        ready = await client.post(f"{API}/store-orders/{sid}/ready", headers=_bearer(owner))
        assert ready.json()["status"] == "ready"

    async def test_rechazar_un_pedido_pagado(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        store_order, owner = await self._paid_store_order(client, app)
        response = await client.post(
            f"{API}/store-orders/{store_order['id']}/reject", headers=_bearer(owner)
        )
        assert response.json()["status"] == "rejected"

    async def test_no_se_puede_aceptar_antes_de_pagar(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, product, owner = await _store_with_product(client, app)
        customer = await _register(client, "cliente@correo.com")
        created = (
            await client.post(
                f"{API}/orders",
                json=_order_body(store["id"], product["id"]),
                headers=_bearer(customer),
            )
        ).json()
        store_order_id = created["store_orders"][0]["id"]

        response = await client.post(
            f"{API}/store-orders/{store_order_id}/accept", headers=_bearer(owner)
        )
        assert response.status_code == 422
        assert response.json()["code"] == "invalid_store_order_transition"

    async def test_otro_usuario_no_puede_aceptar(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store_order, _owner = await self._paid_store_order(client, app)
        other = await _register(client, "otro@correo.com")
        response = await client.post(
            f"{API}/store-orders/{store_order['id']}/accept", headers=_bearer(other)
        )
        assert response.status_code == 403

    async def test_store_order_inexistente(self, client: httpx.AsyncClient) -> None:
        owner = await _register(client)
        response = await client.post(f"{API}/store-orders/{uuid4()}/accept", headers=_bearer(owner))
        assert response.status_code == 404


class TestWebSocketNotification:
    async def test_notifica_al_dueno_cuando_le_pagan_un_pedido(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, product, owner = await _store_with_product(client, app)
        customer = await _register(client, "cliente@correo.com")

        with TestClient(app).websocket_connect(
            f"{API}/stores/{store['id']}/orders/ws?token={owner['access_token']}"
        ) as ws:
            created = (
                await client.post(
                    f"{API}/orders",
                    json=_order_body(store["id"], product["id"]),
                    headers=_bearer(customer),
                )
            ).json()
            paid = (
                await client.post(f"{API}/orders/{created['id']}/pay", headers=_bearer(customer))
            ).json()

            message = ws.receive_json()
            assert message["type"] == "new_order"
            assert message["store_order_id"] == paid["store_orders"][0]["id"]

    async def test_rechaza_conexion_con_token_invalido(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, _product, _owner = await _store_with_product(client, app)
        with (
            pytest.raises(WebSocketDisconnect),
            TestClient(app).websocket_connect(f"{API}/stores/{store['id']}/orders/ws?token=basura"),
        ):
            pass

    async def test_rechaza_conexion_de_quien_no_es_dueno(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store, _product, _owner = await _store_with_product(client, app)
        other = await _register(client, "otro@correo.com")
        with (
            pytest.raises(WebSocketDisconnect),
            TestClient(app).websocket_connect(
                f"{API}/stores/{store['id']}/orders/ws?token={other['access_token']}"
            ),
        ):
            pass

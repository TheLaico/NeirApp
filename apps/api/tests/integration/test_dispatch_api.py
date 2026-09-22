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


async def _create_product(
    client: httpx.AsyncClient, tokens: dict[str, Any], store_id: str
) -> dict[str, Any]:
    response = await client.post(
        f"{API}/stores/{store_id}/products", json=PRODUCT_BODY, headers=_bearer(tokens)
    )
    assert response.status_code == 201, response.text
    return response.json()  # type: ignore[no-any-return]


async def _verified_courier(
    client: httpx.AsyncClient, app: FastAPI, email: str = "repartidor@correo.com"
) -> dict[str, Any]:
    tokens = await _register(client, email)
    created = await client.post(f"{API}/couriers/me", json=COURIER_BODY, headers=_bearer(tokens))
    assert created.status_code == 201, created.text
    admin = await _admin_tokens(client, app)
    verify = await client.patch(
        f"{API}/couriers/{created.json()['id']}/verification",
        json={"is_verified": True},
        headers=_bearer(admin),
    )
    assert verify.status_code == 200, verify.text
    return tokens


async def _claimable_order(
    client: httpx.AsyncClient, app: FastAPI
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    """Crea, paga y acepta un pedido de una sola tienda. Devuelve
    (order, store_order, store_owner_tokens, customer_tokens)."""
    owner = await _register(client, "duena@correo.com")
    store = await _create_approved_store(client, app, owner)
    product = await _create_product(client, owner, store["id"])
    customer = await _register(client, "cliente@correo.com")

    created = (
        await client.post(
            f"{API}/orders",
            json={
                "delivery_lat": NEIRA_LAT,
                "delivery_lng": NEIRA_LNG,
                "delivery_notes": "Casa azul",
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
    ready = (
        await client.post(f"{API}/store-orders/{store_order_id}/ready", headers=_bearer(owner))
    ).json()
    return created, ready, owner, customer


class TestCourierProfile:
    async def test_crear_perfil(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        response = await client.post(
            f"{API}/couriers/me", json=COURIER_BODY, headers=_bearer(tokens)
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["plate"] == "ABC123"
        assert body["is_verified"] is False

    async def test_no_se_puede_crear_dos_perfiles(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        await client.post(f"{API}/couriers/me", json=COURIER_BODY, headers=_bearer(tokens))
        response = await client.post(
            f"{API}/couriers/me", json=COURIER_BODY, headers=_bearer(tokens)
        )
        assert response.status_code == 422
        assert response.json()["code"] == "courier_profile_already_exists"

    async def test_moto_sin_placa_falla(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        response = await client.post(
            f"{API}/couriers/me",
            json={"vehicle_type": "motorcycle", "id_document_number": "123456789"},
            headers=_bearer(tokens),
        )
        assert response.status_code == 422
        assert response.json()["code"] == "invalid_plate"

    async def test_get_me_sin_perfil_devuelve_null(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        response = await client.get(f"{API}/couriers/me", headers=_bearer(tokens))
        assert response.status_code == 200
        assert response.json() is None

    async def test_solo_admin_ve_pendientes(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        await client.post(f"{API}/couriers/me", json=COURIER_BODY, headers=_bearer(tokens))
        response = await client.get(f"{API}/couriers/pending", headers=_bearer(tokens))
        assert response.status_code == 403

    async def test_admin_verifica_courier(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        tokens = await _register(client)
        created = (
            await client.post(f"{API}/couriers/me", json=COURIER_BODY, headers=_bearer(tokens))
        ).json()
        admin = await _admin_tokens(client, app)

        pending = await client.get(f"{API}/couriers/pending", headers=_bearer(admin))
        assert [p["id"] for p in pending.json()] == [created["id"]]

        verified = await client.patch(
            f"{API}/couriers/{created['id']}/verification",
            json={"is_verified": True},
            headers=_bearer(admin),
        )
        assert verified.status_code == 200
        assert verified.json()["is_verified"] is True


class TestListAvailableDeliveries:
    async def test_repartidor_no_verificado_no_puede_listar(
        self, client: httpx.AsyncClient
    ) -> None:
        tokens = await _register(client)
        await client.post(f"{API}/couriers/me", json=COURIER_BODY, headers=_bearer(tokens))
        response = await client.get(f"{API}/deliveries/available", headers=_bearer(tokens))
        assert response.status_code == 403
        assert response.json()["code"] == "courier_not_verified"

    async def test_sin_perfil_de_repartidor_falla(self, client: httpx.AsyncClient) -> None:
        tokens = await _register(client)
        response = await client.get(f"{API}/deliveries/available", headers=_bearer(tokens))
        assert response.status_code == 404
        assert response.json()["code"] == "courier_profile_not_found"

    async def test_pedido_aceptado_aparece_disponible(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order, _store_order, _owner, _customer = await _claimable_order(client, app)
        courier = await _verified_courier(client, app)

        response = await client.get(f"{API}/deliveries/available", headers=_bearer(courier))
        assert response.status_code == 200
        assert [o["order_id"] for o in response.json()] == [order["id"]]

    async def test_pedido_pendiente_de_pago_no_aparece(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        owner = await _register(client, "duena@correo.com")
        store = await _create_approved_store(client, app, owner)
        product = await _create_product(client, owner, store["id"])
        customer = await _register(client, "cliente@correo.com")
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
        courier = await _verified_courier(client, app)
        response = await client.get(f"{API}/deliveries/available", headers=_bearer(courier))
        assert response.json() == []


class TestClaimAndDeliveryFlow:
    async def test_flujo_completo_reclamar_recoger_entregar(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order, store_order, owner, customer = await _claimable_order(client, app)
        courier = await _verified_courier(client, app)

        claimed = await client.post(
            f"{API}/deliveries/{order['id']}/claim", headers=_bearer(courier)
        )
        assert claimed.status_code == 201, claimed.text
        delivery = claimed.json()
        assert delivery["status"] == "assigned"
        assert len(delivery["stops"]) == 1
        pickup_code = delivery["stops"][0]["pickup_code"]

        active = await client.get(f"{API}/deliveries/mine/active", headers=_bearer(courier))
        assert active.json()["id"] == delivery["id"]

        confirm_pickup = await client.post(
            f"{API}/deliveries/store-orders/{store_order['id']}/confirm-pickup",
            json={"code": pickup_code},
            headers=_bearer(owner),
        )
        assert confirm_pickup.status_code == 200, confirm_pickup.text
        assert confirm_pickup.json()["is_picked_up"] is True

        customer_view = await client.get(
            f"{API}/deliveries/by-order/{order['id']}", headers=_bearer(customer)
        )
        assert customer_view.status_code == 200
        delivery_code = customer_view.json()["delivery_code"]
        assert customer_view.json()["stops_picked_up"] == 1

        confirm_delivery = await client.post(
            f"{API}/deliveries/{delivery['id']}/confirm-delivery",
            json={"code": delivery_code},
            headers=_bearer(courier),
        )
        assert confirm_delivery.status_code == 200, confirm_delivery.text
        assert confirm_delivery.json()["status"] == "delivered"

        history = await client.get(f"{API}/deliveries/mine/history", headers=_bearer(courier))
        assert [d["id"] for d in history.json()] == [delivery["id"]]

        balance = await client.get(f"{API}/wallet/balance", headers=_bearer(courier))
        assert balance.json()["balance_cop"] == 3_000 + 1_500

    async def test_segundo_repartidor_no_puede_reclamar_lo_mismo(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order, _store_order, _owner, _customer = await _claimable_order(client, app)
        courier_a = await _verified_courier(client, app, "repartidor-a@correo.com")
        courier_b = await _verified_courier(client, app, "repartidor-b@correo.com")

        first = await client.post(
            f"{API}/deliveries/{order['id']}/claim", headers=_bearer(courier_a)
        )
        assert first.status_code == 201

        second = await client.post(
            f"{API}/deliveries/{order['id']}/claim", headers=_bearer(courier_b)
        )
        assert second.status_code == 422
        assert second.json()["code"] == "order_already_claimed"

    async def test_pedido_inexistente_no_se_puede_reclamar(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        courier = await _verified_courier(client, app)
        response = await client.post(f"{API}/deliveries/{uuid4()}/claim", headers=_bearer(courier))
        assert response.status_code == 422
        assert response.json()["code"] == "order_not_claimable"

    async def test_tienda_ajena_no_puede_confirmar_recogida(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order, store_order, _owner, _customer = await _claimable_order(client, app)
        courier = await _verified_courier(client, app)
        claimed = (
            await client.post(f"{API}/deliveries/{order['id']}/claim", headers=_bearer(courier))
        ).json()
        pickup_code = claimed["stops"][0]["pickup_code"]

        other = await _register(client, "otra-tienda@correo.com")
        response = await client.post(
            f"{API}/deliveries/store-orders/{store_order['id']}/confirm-pickup",
            json={"code": pickup_code},
            headers=_bearer(other),
        )
        assert response.status_code == 403
        assert response.json()["code"] == "not_stop_store_owner"

    async def test_codigo_de_recogida_incorrecto_falla(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order, store_order, owner, _customer = await _claimable_order(client, app)
        courier = await _verified_courier(client, app)
        await client.post(f"{API}/deliveries/{order['id']}/claim", headers=_bearer(courier))

        response = await client.post(
            f"{API}/deliveries/store-orders/{store_order['id']}/confirm-pickup",
            json={"code": "000000"},
            headers=_bearer(owner),
        )
        assert response.status_code == 422
        assert response.json()["code"] == "invalid_pickup_code"

    async def test_otro_cliente_no_ve_el_codigo_de_entrega(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order, _store_order, _owner, _customer = await _claimable_order(client, app)
        courier = await _verified_courier(client, app)
        await client.post(f"{API}/deliveries/{order['id']}/claim", headers=_bearer(courier))

        other = await _register(client, "otro-cliente@correo.com")
        response = await client.get(
            f"{API}/deliveries/by-order/{order['id']}", headers=_bearer(other)
        )
        assert response.status_code == 403
        assert response.json()["code"] == "not_order_customer"

    async def test_cancelar_entrega(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        order, _store_order, _owner, _customer = await _claimable_order(client, app)
        courier = await _verified_courier(client, app)
        claimed = (
            await client.post(f"{API}/deliveries/{order['id']}/claim", headers=_bearer(courier))
        ).json()

        response = await client.post(
            f"{API}/deliveries/{claimed['id']}/cancel", headers=_bearer(courier)
        )
        assert response.status_code == 200
        assert response.json()["status"] == "cancelled"

    async def test_otro_repartidor_no_puede_cancelar(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order, _store_order, _owner, _customer = await _claimable_order(client, app)
        courier_a = await _verified_courier(client, app, "repartidor-a@correo.com")
        courier_b = await _verified_courier(client, app, "repartidor-b@correo.com")
        claimed = (
            await client.post(f"{API}/deliveries/{order['id']}/claim", headers=_bearer(courier_a))
        ).json()

        response = await client.post(
            f"{API}/deliveries/{claimed['id']}/cancel", headers=_bearer(courier_b)
        )
        assert response.status_code == 403
        assert response.json()["code"] == "not_delivery_courier"

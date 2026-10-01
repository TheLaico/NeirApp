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


async def _handed_over_store_order(
    client: httpx.AsyncClient,
    app: FastAPI,
    customer_email: str = "cliente@correo.com",
    *,
    store: dict[str, Any] | None = None,
    owner: dict[str, Any] | None = None,
) -> tuple[str, dict[str, Any], str]:
    """Crea, paga, avanza y entrega al repartidor un pedido de una sola tienda. Devuelve
    (store_order_id, customer_tokens, store_id). Reutiliza `store`/`owner` si se pasan, para que
    varios pedidos completos caigan sobre la misma tienda."""
    if store is None or owner is None:
        owner = await _register(client, "duena@correo.com")
        store = await _create_approved_store(client, app, owner)
    product = (
        await client.post(
            f"{API}/stores/{store['id']}/products", json=PRODUCT_BODY, headers=_bearer(owner)
        )
    ).json()
    customer = await _register(client, customer_email)

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

    courier = await _register(client, f"repartidor-{customer_email}")
    profile = (
        await client.post(f"{API}/couriers/me", json=COURIER_BODY, headers=_bearer(courier))
    ).json()
    admin = await _admin_tokens(client, app)
    await client.patch(
        f"{API}/couriers/{profile['id']}/verification",
        json={"is_verified": True},
        headers=_bearer(admin),
    )
    claimed = (
        await client.post(f"{API}/deliveries/{created['id']}/claim", headers=_bearer(courier))
    ).json()
    pickup_code = claimed["stops"][0]["pickup_code"]
    await client.post(
        f"{API}/deliveries/store-orders/{store_order_id}/confirm-pickup",
        json={"code": pickup_code},
        headers=_bearer(owner),
    )
    return store_order_id, customer, store["id"]


class TestCreateReview:
    async def test_calificar_un_pedido_completado(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store_order_id, customer, store_id = await _handed_over_store_order(client, app)
        response = await client.post(
            f"{API}/reviews",
            json={"store_order_id": store_order_id, "rating": 5, "comment": "Excelente"},
            headers=_bearer(customer),
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["rating"] == 5
        assert body["comment"] == "Excelente"

        listing = await client.get(f"{API}/reviews/stores/{store_id}")
        assert len(listing.json()) == 1

    async def test_no_se_puede_calificar_antes_de_completarse(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        owner = await _register(client, "duena2@correo.com")
        store = await _create_approved_store(client, app, owner)
        product = (
            await client.post(
                f"{API}/stores/{store['id']}/products", json=PRODUCT_BODY, headers=_bearer(owner)
            )
        ).json()
        customer = await _register(client, "cliente2@correo.com")
        created = (
            await client.post(
                f"{API}/orders",
                json={
                    "delivery_lat": NEIRA_LAT,
                    "delivery_lng": NEIRA_LNG,
                    "delivery_notes": "",
                    "items": [
                        {"store_id": store["id"], "product_id": product["id"], "quantity": 1}
                    ],
                },
                headers=_bearer(customer),
            )
        ).json()
        paid = (
            await client.post(f"{API}/orders/{created['id']}/pay", headers=_bearer(customer))
        ).json()
        store_order_id = paid["store_orders"][0]["id"]

        response = await client.post(
            f"{API}/reviews",
            json={"store_order_id": store_order_id, "rating": 5, "comment": None},
            headers=_bearer(customer),
        )
        assert response.status_code == 422
        assert response.json()["code"] == "store_order_not_completed"

    async def test_otro_usuario_no_puede_calificar(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store_order_id, _customer, _store_id = await _handed_over_store_order(client, app)
        other = await _register(client, "otro@correo.com")
        response = await client.post(
            f"{API}/reviews",
            json={"store_order_id": store_order_id, "rating": 5, "comment": None},
            headers=_bearer(other),
        )
        assert response.status_code == 403
        assert response.json()["code"] == "not_store_order_customer"

    async def test_no_se_puede_calificar_dos_veces(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        store_order_id, customer, _store_id = await _handed_over_store_order(client, app)
        await client.post(
            f"{API}/reviews",
            json={"store_order_id": store_order_id, "rating": 4, "comment": None},
            headers=_bearer(customer),
        )
        response = await client.post(
            f"{API}/reviews",
            json={"store_order_id": store_order_id, "rating": 2, "comment": None},
            headers=_bearer(customer),
        )
        assert response.status_code == 409
        assert response.json()["code"] == "review_already_exists"

    async def test_pedido_inexistente(self, client: httpx.AsyncClient) -> None:
        customer = await _register(client)
        response = await client.post(
            f"{API}/reviews",
            json={"store_order_id": str(uuid4()), "rating": 5, "comment": None},
            headers=_bearer(customer),
        )
        assert response.status_code == 404
        assert response.json()["code"] == "reviewable_store_order_not_found"

    async def test_rating_fuera_de_rango_lo_rechaza_el_request(
        self, client: httpx.AsyncClient
    ) -> None:
        customer = await _register(client)
        response = await client.post(
            f"{API}/reviews",
            json={"store_order_id": str(uuid4()), "rating": 6, "comment": None},
            headers=_bearer(customer),
        )
        assert response.status_code == 422


class TestStoreReviews:
    async def test_resumen_de_calificacion_promedia_varios_pedidos(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        owner = await _register(client, "duena-resumen@correo.com")
        store = await _create_approved_store(client, app, owner)

        store_order_a, customer_a, store_id = await _handed_over_store_order(
            client, app, "cliente-a@correo.com", store=store, owner=owner
        )
        await client.post(
            f"{API}/reviews",
            json={"store_order_id": store_order_a, "rating": 5, "comment": None},
            headers=_bearer(customer_a),
        )
        store_order_b, customer_b, _ = await _handed_over_store_order(
            client, app, "cliente-b@correo.com", store=store, owner=owner
        )
        await client.post(
            f"{API}/reviews",
            json={"store_order_id": store_order_b, "rating": 3, "comment": None},
            headers=_bearer(customer_b),
        )

        summary = await client.get(f"{API}/reviews/stores/{store_id}/summary")
        assert summary.json() == {"average": 4.0, "count": 2}
        listing = await client.get(f"{API}/reviews/stores/{store_id}")
        assert len(listing.json()) == 2

    async def test_resumen_vacio(self, client: httpx.AsyncClient) -> None:
        response = await client.get(f"{API}/reviews/stores/{uuid4()}/summary")
        assert response.json() == {"average": 0.0, "count": 0}

    async def test_lista_vacia_para_tienda_sin_reviews(self, client: httpx.AsyncClient) -> None:
        response = await client.get(f"{API}/reviews/stores/{uuid4()}")
        assert response.json() == []


class TestResumenDeTodasLasTiendas:
    async def test_lista_el_promedio_de_cada_tienda_con_resenas(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        assert (await client.get(f"{API}/reviews/summaries")).json() == []

        store_order_id, customer, store_id = await _handed_over_store_order(client, app)
        await client.post(
            f"{API}/reviews",
            json={"store_order_id": store_order_id, "rating": 4},
            headers=_bearer(customer),
        )

        summaries = (await client.get(f"{API}/reviews/summaries")).json()
        assert summaries == [{"store_id": store_id, "average": 4.0, "count": 1}]

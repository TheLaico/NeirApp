"""Productos destacados: el comerciante paga $ 7.000 y, cuando el administrador confirma el pago,
el producto sale en "Productos recomendados" del inicio."""

from datetime import datetime, timedelta
from typing import Any

import httpx
from fastapi import FastAPI

from tests.integration.test_reviews_api import (
    API,
    STORE_BODY,
    _admin_tokens,
    _bearer,
    _register,
)

PROMOTED = f"{API}/products/promoted"
ADMIN = f"{API}/admin/product-promotions"


async def _store_with_product(
    client: httpx.AsyncClient, app: FastAPI
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    admin = await _admin_tokens(client, app)
    owner = await _register(client, "duena@correo.com")
    store = (await client.post(f"{API}/stores", json=STORE_BODY, headers=_bearer(owner))).json()
    await client.patch(
        f"{API}/stores/{store['id']}/approval", json={"is_approved": True}, headers=_bearer(admin)
    )
    product = (
        await client.post(
            f"{API}/stores/{store['id']}/products",
            json={"name": "Pan de queso", "price_cop": 2500},
            headers=_bearer(owner),
        )
    ).json()
    return admin, owner, store, product


async def _request(
    client: httpx.AsyncClient, owner: dict[str, Any], store: dict[str, Any], product_id: str
) -> httpx.Response:
    return await client.post(
        f"{API}/stores/{store['id']}/promotions",
        json={"product_id": product_id, "reference": "Nequi M123"},
        headers=_bearer(owner),
    )


class TestProductosDestacados:
    async def test_el_producto_sale_en_recomendados_cuando_el_admin_confirma(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin, owner, store, product = await _store_with_product(client, app)

        sent = await _request(client, owner, store, product["id"])
        assert sent.status_code == 201
        body = sent.json()
        assert body["status"] == "pending"
        assert body["amount_cop"] == 7000
        assert body["product"]["name"] == "Pan de queso"
        # Mientras no lo confirman, no sale.
        assert (await client.get(PROMOTED)).json() == []

        listed = (await client.get(ADMIN, headers=_bearer(admin))).json()
        assert [p["id"] for p in listed] == [body["id"]]

        approved = await client.post(f"{ADMIN}/{body['id']}/approve", headers=_bearer(admin))
        assert approved.json()["status"] == "approved"
        assert approved.json()["is_active"] is True

        promoted = (await client.get(PROMOTED)).json()
        assert [r["product"]["id"] for r in promoted] == [product["id"]]
        assert promoted[0]["store"]["category"] == STORE_BODY["category"]

        # El administrador lo quita y deja de salir.
        await client.post(f"{ADMIN}/{body['id']}/end", headers=_bearer(admin))
        assert (await client.get(PROMOTED)).json() == []

    async def test_renovar_suma_los_dias_al_final(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin, owner, store, product = await _store_with_product(client, app)
        first = (await _request(client, owner, store, product["id"])).json()
        a = (await client.post(f"{ADMIN}/{first['id']}/approve", headers=_bearer(admin))).json()
        second = (await _request(client, owner, store, product["id"])).json()
        b = (await client.post(f"{ADMIN}/{second['id']}/approve", headers=_bearer(admin))).json()

        assert b["starts_at"] == a["expires_at"]
        end = datetime.fromisoformat(b["expires_at"]) - datetime.fromisoformat(a["starts_at"])
        assert end == timedelta(days=60)
        assert len((await client.get(PROMOTED)).json()) == 1  # no sale repetido

    async def test_solo_productos_que_van_al_carrito(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        _admin, owner, store, product = await _store_with_product(client, app)
        await client.patch(
            f"{API}/stores/{store['id']}/products/{product['id']}/availability",
            json={"is_available": False},
            headers=_bearer(owner),
        )

        response = await _request(client, owner, store, product["id"])

        assert response.status_code == 422
        assert response.json()["code"] == "product_not_promotable"

    async def test_un_agotado_deja_de_salir_aunque_este_pagado(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin, owner, store, product = await _store_with_product(client, app)
        sent = (await _request(client, owner, store, product["id"])).json()
        await client.post(f"{ADMIN}/{sent['id']}/approve", headers=_bearer(admin))

        await client.patch(
            f"{API}/stores/{store['id']}/products/{product['id']}/availability",
            json={"is_available": False},
            headers=_bearer(owner),
        )

        assert (await client.get(PROMOTED)).json() == []

    async def test_un_pago_a_la_vez_y_se_puede_cancelar(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        _admin, owner, store, product = await _store_with_product(client, app)
        sent = (await _request(client, owner, store, product["id"])).json()

        again = await _request(client, owner, store, product["id"])
        assert again.status_code == 409
        assert again.json()["code"] == "promotion_pending"

        cancelled = await client.delete(
            f"{API}/stores/{store['id']}/promotions/{sent['id']}", headers=_bearer(owner)
        )
        assert cancelled.json()["status"] == "cancelled"
        assert (await _request(client, owner, store, product["id"])).status_code == 201

    async def test_el_admin_puede_rechazar_con_motivo(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        admin, owner, store, product = await _store_with_product(client, app)
        sent = (await _request(client, owner, store, product["id"])).json()

        rejected = await client.post(
            f"{ADMIN}/{sent['id']}/reject",
            json={"note": "No vemos el pago en Nequi"},
            headers=_bearer(admin),
        )

        assert rejected.json()["status"] == "rejected"
        mine = await client.get(f"{API}/stores/{store['id']}/promotions", headers=_bearer(owner))
        assert mine.json()[0]["note"] == "No vemos el pago en Nequi"
        assert (await client.get(PROMOTED)).json() == []

    async def test_solo_el_dueno_y_el_admin(self, client: httpx.AsyncClient, app: FastAPI) -> None:
        _admin, owner, store, product = await _store_with_product(client, app)
        other = await _register(client, "otro@correo.com")

        assert (await _request(client, other, store, product["id"])).status_code == 403
        listed = await client.get(f"{API}/stores/{store['id']}/promotions", headers=_bearer(other))
        assert listed.status_code == 403
        assert (await client.get(ADMIN, headers=_bearer(owner))).status_code == 403

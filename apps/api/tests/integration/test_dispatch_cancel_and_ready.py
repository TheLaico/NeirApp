from typing import Any

import httpx
from fastapi import FastAPI

from tests.integration.test_dispatch_api import (
    API,
    NEIRA_LAT,
    NEIRA_LNG,
    _bearer,
    _claimable_order,
    _create_approved_store,
    _create_product,
    _register,
    _verified_courier,
)


async def _claim(client: httpx.AsyncClient, courier: dict[str, Any], order_id: str) -> Any:
    return await client.post(f"{API}/deliveries/{order_id}/claim", headers=_bearer(courier))


async def _cancel(client: httpx.AsyncClient, courier: dict[str, Any], delivery_id: str) -> Any:
    return await client.post(f"{API}/deliveries/{delivery_id}/cancel", headers=_bearer(courier))


async def _available_ids(client: httpx.AsyncClient, courier: dict[str, Any]) -> list[str]:
    response = await client.get(f"{API}/deliveries/available", headers=_bearer(courier))
    return [o["order_id"] for o in response.json()]


class TestCancelarYReclamarDeNuevo:
    async def test_otro_repartidor_puede_tomar_el_pedido_tras_cancelar(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order, store_order, owner, customer = await _claimable_order(client, app)
        courier_a = await _verified_courier(client, app, "a@correo.com")
        courier_b = await _verified_courier(client, app, "b@correo.com")
        first = (await _claim(client, courier_a, order["id"])).json()

        cancelled = await _cancel(client, courier_a, first["id"])
        assert cancelled.json()["status"] == "cancelled"

        # El pedido vuelve a la lista y el cliente no ve una entrega viva mientras nadie lo toma.
        assert order["id"] in await _available_ids(client, courier_b)
        by_order = await client.get(
            f"{API}/deliveries/by-order/{order['id']}", headers=_bearer(customer)
        )
        assert by_order.json() is None

        second = await _claim(client, courier_b, order["id"])
        assert second.status_code == 201, second.text
        assert second.json()["id"] != first["id"]

        # Ya nadie más lo ve disponible.
        assert order["id"] not in await _available_ids(client, courier_a)

        # La entrega cancelada queda en el historial del primero; la vigente es del segundo.
        history_a = await client.get(f"{API}/deliveries/mine/history", headers=_bearer(courier_a))
        assert [d["status"] for d in history_a.json()] == ["cancelled"]
        active_b = await client.get(f"{API}/deliveries/mine/active", headers=_bearer(courier_b))
        assert active_b.json()["id"] == second.json()["id"]

        # El cliente ve el código de la entrega vigente y la tienda confirma con el código nuevo.
        by_order = await client.get(
            f"{API}/deliveries/by-order/{order['id']}", headers=_bearer(customer)
        )
        assert len(by_order.json()["delivery_code"]) == 6
        good = await client.post(
            f"{API}/deliveries/store-orders/{store_order['id']}/confirm-pickup",
            json={"code": second.json()["stops"][0]["pickup_code"]},
            headers=_bearer(owner),
        )
        assert good.status_code == 200, good.text

    async def test_el_mismo_repartidor_puede_retomarlo(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order, _so, _owner, _customer = await _claimable_order(client, app)
        courier = await _verified_courier(client, app)
        first = (await _claim(client, courier, order["id"])).json()
        await _cancel(client, courier, first["id"])

        again = await _claim(client, courier, order["id"])

        assert again.status_code == 201, again.text

    async def test_mientras_esta_viva_nadie_mas_puede_reclamarlo(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order, _so, _owner, _customer = await _claimable_order(client, app)
        courier_a = await _verified_courier(client, app, "a@correo.com")
        courier_b = await _verified_courier(client, app, "b@correo.com")
        first = (await _claim(client, courier_a, order["id"])).json()
        await _cancel(client, courier_a, first["id"])
        await _claim(client, courier_b, order["id"])

        third = await _claim(client, courier_a, order["id"])

        assert third.status_code == 422
        assert third.json()["code"] == "order_already_claimed"

    async def test_no_se_puede_cancelar_con_algo_ya_recogido(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order, store_order, owner, _customer = await _claimable_order(client, app)
        courier = await _verified_courier(client, app)
        claimed = (await _claim(client, courier, order["id"])).json()
        await client.post(
            f"{API}/deliveries/store-orders/{store_order['id']}/confirm-pickup",
            json={"code": claimed["stops"][0]["pickup_code"]},
            headers=_bearer(owner),
        )

        response = await _cancel(client, courier, claimed["id"])

        assert response.status_code == 422
        assert response.json()["code"] == "cannot_cancel_after_pickup"


class TestPinSoloConPedidoListo:
    async def _accepted_only(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        """Pedido pagado y aceptado, pero todavía NO marcado como listo."""
        owner = await _register(client, "duena@correo.com")
        store = await _create_approved_store(client, app, owner)
        product = await _create_product(client, owner, store["id"])
        customer = await _register(client, "cliente@correo.com")
        item = {"store_id": store["id"], "product_id": product["id"], "quantity": 1}
        created = (
            await client.post(
                f"{API}/orders",
                json={
                    "delivery_lat": NEIRA_LAT,
                    "delivery_lng": NEIRA_LNG,
                    "delivery_notes": "",
                    "items": [item],
                },
                headers=_bearer(customer),
            )
        ).json()
        paid = (
            await client.post(f"{API}/orders/{created['id']}/pay", headers=_bearer(customer))
        ).json()
        store_order = paid["store_orders"][0]
        await client.post(f"{API}/store-orders/{store_order['id']}/accept", headers=_bearer(owner))
        return created, store_order, owner

    async def test_no_se_confirma_la_recogida_si_no_esta_listo(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order, store_order, owner = await self._accepted_only(client, app)
        courier = await _verified_courier(client, app)
        claimed = (await _claim(client, courier, order["id"])).json()
        code = claimed["stops"][0]["pickup_code"]
        url = f"{API}/deliveries/store-orders/{store_order['id']}/confirm-pickup"

        early = await client.post(url, json={"code": code}, headers=_bearer(owner))

        assert early.status_code == 422
        assert early.json()["code"] == "store_order_not_ready"
        # La recogida no quedó a medias: la parada sigue sin recoger.
        mine = await client.get(f"{API}/deliveries/mine/active", headers=_bearer(courier))
        assert mine.json()["stops"][0]["is_picked_up"] is False

        # Con el pedido listo, el mismo código ya funciona.
        for step in ("preparing", "ready"):
            await client.post(
                f"{API}/store-orders/{store_order['id']}/{step}", headers=_bearer(owner)
            )
        late = await client.post(url, json={"code": code}, headers=_bearer(owner))
        assert late.status_code == 200, late.text

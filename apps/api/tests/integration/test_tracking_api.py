"""Mapa en vivo: los repartidores reportan su posición y el administrador las ve."""

import httpx
from fastapi import FastAPI

from tests.conftest import FakeClock
from tests.integration.test_dispatch_api import (
    API,
    _admin_tokens,
    _bearer,
    _claimable_order,
    _register,
    _verified_courier,
)

HERE = {"lat": 5.1667, "lng": -75.5167, "heading": 90}


class TestUbicacionDeRepartidores:
    async def test_el_repartidor_reporta_y_el_admin_lo_ve_en_linea(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        courier = await _verified_courier(client, app)
        admin = await _admin_tokens(client, app)

        sent = await client.put(f"{API}/couriers/me/location", json=HERE, headers=_bearer(courier))
        assert sent.status_code == 204, sent.text

        live = (await client.get(f"{API}/couriers/live", headers=_bearer(admin))).json()
        assert len(live) == 1
        assert live[0]["email"] == "repartidor@correo.com"
        assert (live[0]["lat"], live[0]["lng"], live[0]["heading"]) == (5.1667, -75.5167, 90)
        assert live[0]["is_online"] is True
        assert live[0]["vehicle_type"] == "motorcycle"
        assert live[0]["active_order_id"] is None

    async def test_solo_queda_la_ultima_posicion(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        courier = await _verified_courier(client, app)
        admin = await _admin_tokens(client, app)

        await client.put(f"{API}/couriers/me/location", json=HERE, headers=_bearer(courier))
        moved = {"lat": 5.17, "lng": -75.52}
        await client.put(f"{API}/couriers/me/location", json=moved, headers=_bearer(courier))

        live = (await client.get(f"{API}/couriers/live", headers=_bearer(admin))).json()
        assert [(c["lat"], c["lng"]) for c in live] == [(5.17, -75.52)]

    async def test_deja_de_estar_en_linea_si_no_reporta(
        self, client: httpx.AsyncClient, app: FastAPI, clock: FakeClock
    ) -> None:
        courier = await _verified_courier(client, app)
        admin = await _admin_tokens(client, app)
        await client.put(f"{API}/couriers/me/location", json=HERE, headers=_bearer(courier))

        clock.advance(minutes=5)
        admin = await _admin_tokens(client, app)  # el token de antes vence con el reloj de prueba
        live = (await client.get(f"{API}/couriers/live", headers=_bearer(admin))).json()
        assert live[0]["is_online"] is False

        clock.advance(hours=25)
        admin = await _admin_tokens(client, app)
        assert (await client.get(f"{API}/couriers/live", headers=_bearer(admin))).json() == []

    async def test_la_lista_es_solo_para_el_admin(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        courier = await _verified_courier(client, app)
        assert (
            await client.get(f"{API}/couriers/live", headers=_bearer(courier))
        ).status_code == 403
        assert (await client.get(f"{API}/couriers/live")).status_code == 401

    async def test_requiere_repartidor_verificado_y_datos_validos(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        stranger = await _register(client, "cliente@correo.com")
        no_profile = await client.put(
            f"{API}/couriers/me/location", json=HERE, headers=_bearer(stranger)
        )
        assert no_profile.status_code == 404

        courier = await _verified_courier(client, app)
        bad = await client.put(
            f"{API}/couriers/me/location", json={"lat": 999, "lng": 0}, headers=_bearer(courier)
        )
        assert bad.status_code == 422


class TestRutaDelRepartidorEnElMapa:
    async def test_el_admin_ve_las_tiendas_y_la_casa_de_la_entrega_en_curso(
        self, client: httpx.AsyncClient, app: FastAPI
    ) -> None:
        order, _store_order, _owner, _customer = await _claimable_order(client, app)
        courier = await _verified_courier(client, app)
        admin = await _admin_tokens(client, app)
        await client.put(f"{API}/couriers/me/location", json=HERE, headers=_bearer(courier))

        idle = (await client.get(f"{API}/couriers/live", headers=_bearer(admin))).json()[0]
        assert idle["stops"] == []
        assert idle["delivery_lat"] is None

        claimed = await client.post(
            f"{API}/deliveries/{order['id']}/claim", headers=_bearer(courier)
        )
        assert claimed.status_code == 201, claimed.text

        busy = (await client.get(f"{API}/couriers/live", headers=_bearer(admin))).json()[0]
        assert busy["active_order_id"] == order["id"]
        assert [(s["store_name"], s["is_picked_up"]) for s in busy["stops"]] == [
            ("Pizzería Napoli", False)
        ]
        assert (busy["delivery_lat"], busy["delivery_lng"]) == (
            order["delivery_lat"],
            order["delivery_lng"],
        )
